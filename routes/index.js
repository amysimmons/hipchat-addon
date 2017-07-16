var http = require('request');
var cors = require('cors');
var uuid = require('uuid');
var url = require('url');
var moment = require('moment');

// This is the heart of your HipChat Connect add-on. For more information,
// take a look at https://developer.atlassian.com/hipchat/tutorials/getting-started-with-atlassian-connect-express-node-js
module.exports = function (app, addon) {
  var hipchat = require('../lib/hipchat')(addon);

  // simple healthcheck
  app.get('/healthcheck', function (req, res) {
    res.send('OK');
  });

  // Root route. This route will serve the `addon.json` unless a homepage URL is
  // specified in `addon.json`.
  app.get('/',
    function (req, res) {
      // Use content-type negotiation to choose the best way to respond
      res.format({
        // If the request content-type is text-html, it will decide which to serve up
        'text/html': function () {
          var homepage = url.parse(addon.descriptor.links.homepage);
          if (homepage.hostname === req.hostname && homepage.path === req.path) {
            res.render('homepage', addon.descriptor);
          } else {
            res.redirect(addon.descriptor.links.homepage);
          }
        },
        // This logic is here to make sure that the `addon.json` is always
        // served up when requested by the host
        'application/json': function () {
          res.redirect('/atlassian-connect.json');
        }
      });
    }
    );

  // This is an example route that's used by the default for the configuration page
  // https://developer.atlassian.com/hipchat/guide/configuration-page
  app.get('/config',
    // Authenticates the request using the JWT token in the request
    addon.authenticate(),
    function (req, res) {
      // The `addon.authenticate()` middleware populates the following:
      // * req.clientInfo: useful information about the add-on client such as the
      //   clientKey, oauth info, and HipChat account info
      // * req.context: contains the context data accompanying the request like
      //   the roomId
      res.render('config', req.context);
    }
    );

  // This is an example glance that shows in the sidebar
  // https://developer.atlassian.com/hipchat/guide/glances
  app.get('/glance',
    cors(),
    addon.authenticate(),
    function (req, res) {
      res.json({
        "label": {
          "type": "html",
          "value": "Retro Notes"
        },
        "status": {
          "type": "lozenge",
          "value": {
            "label": "NEW",
            "type": "error"
          }
        }
      });
    }
    );

  // This is an example end-point that you can POST to to update the glance info
  // Room update API: https://www.hipchat.com/docs/apiv2/method/room_addon_ui_update
  // Group update API: https://www.hipchat.com/docs/apiv2/method/addon_ui_update
  // User update API: https://www.hipchat.com/docs/apiv2/method/user_addon_ui_update
  app.post('/update_glance',
    cors(),
    addon.authenticate(),
    function (req, res) {
      res.json({
        "label": {
          "type": "html",
          "value": "Hello World!"
        },
        "status": {
          "type": "lozenge",
          "value": {
            "label": "All good",
            "type": "success"
          }
        }
      });
    }
    );

  // This is an example sidebar controller that can be launched when clicking on the glance.
  // https://developer.atlassian.com/hipchat/guide/sidebar
  app.get('/sidebar',
    addon.authenticate(),
    function (req, res) {
      var key = req.context.room_id;
      var userId = req.identity.userId;

      addon.settings.get(key, req.clientInfo.clientKey).then(function (data) {
        var deserializedData = JSON
          .parse(data)
          .map(function(note){
            note.isNoteAuthor = note.messageAuthorId === userId;
            return note;
          });

         res.render('sidebar', {
            retroNotes: deserializedData,
            identity: req.identity
         });
      });
    }
  );

  // This is an example dialog controller that can be launched when clicking on the glance.
  // https://developer.atlassian.com/hipchat/guide/dialog
  app.get('/dialog',
    addon.authenticate(),
    function (req, res) {
      res.render('dialog', {
        identity: req.identity
      });
    }
  );

  //opens the clear all confirmation step dialog
  app.get('/dialog/delete-all',
    addon.authenticate(),
    function (req, res) {
      res.render('delete-all', {
        identity: req.identity
      });
    }
  );

  app.get('/dialog/delete',
    addon.authenticate(),
    function (req, res) {
      res.render('delete', {
        identity: req.identity,
      });
    }
  );

  app.get('/dialog/edit',
    addon.authenticate(),
    function (req, res) {
      res.render('edit', {
        identity: req.identity,
      });
    }
  );

  // Sample endpoint to send a card notification back into the chat room
  // See https://developer.atlassian.com/hipchat/guide/sending-messages
  app.post('/send_notification',
    addon.authenticate(),
    function (req, res) {
      var card = {
        "style": "link",
        "url": "https://www.hipchat.com",
        "id": uuid.v4(),
        "title": req.body.messageTitle,
        "description": "Great teams use HipChat: Group and private chat, file sharing, and integrations",
        "icon": {
          "url": "https://hipchat-public-m5.atlassian.com/assets/img/hipchat/bookmark-icons/favicon-192x192.png"
        }
      };
      var msg = '<b>' + card.title + '</b>: ' + card.description;
      var opts = { 'options': { 'color': 'yellow' } };
      hipchat.sendMessage(req.clientInfo, req.identity.roomId, msg, opts, card);
      res.json({ status: "ok" });
    }
    );


  app.delete('/notes',
    addon.authenticate(),
    function (req, res) {
      var data = JSON.stringify([]);
      addon.settings.set(req.identity.roomId, data, req.clientInfo.clientKey);

      hipchat.sendMessage(req.clientInfo, req.identity.roomId, 'Retro Notes successfully deleted')
        .then(function (data) {
          res.sendStatus(200);
        });
    }
  );

  app.delete('/notes/:id',
    addon.authenticate(),
    function (req, res) {
      var clientKey = req.clientInfo.clientKey;
      var roomId = req.context.room_id;

      addon.settings.get(roomId, clientKey).then(function (retroNotes) {
        if (!retroNotes) { //if there are no current retro notes, do nothing
          return
        }

        var existingRetroNotes = JSON.parse(retroNotes);
        var filteredRetroNotes = existingRetroNotes.filter(function(note){
        // keep the note when it is not the one being deleted,
        // and when the note author is not the request author
            if (!(note.messageId === req.params.id && note.messageAuthorId === req.identity.userId)) {
                return note;
            }
        });

        if (filteredRetroNotes.length < existingRetroNotes.length) {
            var json = JSON.stringify(filteredRetroNotes)
            addon.settings.set(roomId, json, clientKey);

            hipchat.sendMessage(req.clientInfo, req.identity.roomId, 'Retro note deleted')
            .then(function (data) {
                res.sendStatus(204);
            });
        }
      });
    }
  );

    app.put('/notes/:id',
      addon.authenticate(),
      function (req, res) {
        var clientKey = req.clientInfo.clientKey;
        var roomId = req.context.room_id;

        addon.settings.get(roomId, clientKey).then(function (retroNotes) {
          if (!retroNotes) { //if there are no current retro notes, do nothing
            return
          }

          var existingRetroNotes = JSON.parse(retroNotes);

            var updatedRetroNotes = existingRetroNotes.map(function(note){
                if (note.messageId === req.params.id && note.messageAuthorId === req.identity.userId) {
                    note.messageText = req.body.messageText
                    return note;
                } else {
                    return note;
                }
            })

          var json = JSON.stringify(updatedRetroNotes)
          addon.settings.set(roomId, json, clientKey);

          hipchat.sendMessage(req.clientInfo, req.identity.roomId, 'Retro note edited')
          .then(function (data) {
              res.sendStatus(204);
          });
        });
      }
    );

  // This is an example route to handle an incoming webhook
  // https://developer.atlassian.com/hipchat/guide/webhooks
  app.post('/webhook',
    addon.authenticate(),
    function (req, res) {
      var clientKey = req.clientInfo.clientKey;
      var roomId = req.context.room_id;
      var messageText = req.body.item.message.message.split('/retro')[1].trim();

      //if there is no retro note text, don't bother saving it
      if(!messageText.length) {
        hipchat.sendMessage(req.clientInfo, req.identity.roomId, 'Oops, you forgot to type a retro note')
          .then(function (data) {
            res.sendStatus(201);
          });
        return;
      }

      var data = {
        messageAuthorId: req.body.item.message.from.id,
        messageAuthorName: req.body.item.message.from.name,
        messageAuthorMentionName: req.body.item.message.from.mention_name,
        messageId: req.body.item.message.id,
        messageText: messageText,
        messageDate: moment(req.body.item.message.date).format('D MMMM YYYY h:mma')
      };

      //get the existing retro notes for the room
      addon.settings.get(roomId, clientKey).then(function (retroNotes) {
        if (!retroNotes) { //if there are no current retro notes, create the first one
          var firstNote = JSON.stringify([data]);

          addon.settings.set(roomId, firstNote, clientKey);
        } else { //otherwise, add to the existing retro notes
          var existingRetroNotes = JSON.parse(retroNotes);
          var updatedRetroNotes = existingRetroNotes.map(function(note){
            return note;
          });
          updatedRetroNotes.push(data);

          var json = JSON.stringify(updatedRetroNotes)
          addon.settings.set(roomId, json, clientKey);
        }

        hipchat.sendMessage(req.clientInfo, req.identity.roomId, 'Retro note added')
          .then(function (data) {
            res.sendStatus(201);
          });

       });
      }
    );

  // Notify the room that the add-on was installed. To learn more about
  // Connect's install flow, check out:
  // https://developer.atlassian.com/hipchat/guide/installation-flow
  addon.on('installed', function (clientKey, clientInfo, req) {
    hipchat.sendMessage(clientInfo, req.body.roomId, 'The ' + addon.descriptor.name + ' add-on has been installed in this room');
  });

  // Clean up clients when uninstalled
  addon.on('uninstalled', function (id) {
    addon.settings.client.keys(id + ':*', function (err, rep) {
      rep.forEach(function (k) {
        addon.logger.info('Removing key:', k);
        addon.settings.client.del(k);
      });
    });
  });

};
