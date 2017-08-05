/* add-on script */

$(document).ready(function () {

  // Check the theme...
  var theme = getQueryVariable('theme');
  if (theme === 'light' || theme === 'dark') {
    $('body').addClass(theme);
  }

  // Utility functions...

  function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split("=");
      if (pair[0] == variable) {
        return pair[1];
      }
    }
    return false;
  }

  function deleteNotes(callback) {
    //Ask HipChat for a JWT token
    HipChat.auth.withToken(function (err, token) {
      if (!err) {
        //Then, make an AJAX call to the add-on backend, including the JWT token
        //Server-side, the JWT token is validated using the middleware function addon.authenticate()
        $.ajax(
            {
              type: 'DELETE',
              url: '/notes/',
              headers: {'Authorization': 'JWT ' + token},
              dataType: 'json',
              success: function () {
                callback(false);
              },
              error: function () {
                callback(true);
              }
            });
      }
    });
  }

  function deleteNote(noteId, callback) {
    //Ask HipChat for a JWT token
    HipChat.auth.withToken(function (err, token) {
      if (!err) {
        //Then, make an AJAX call to the add-on backend, including the JWT token
        //Server-side, the JWT token is validated using the middleware function addon.authenticate()
        $.ajax(
            {
              type: 'DELETE',
              url: '/notes/' + noteId,
              headers: {'Authorization': 'JWT ' + token},
              dataType: 'json',
              success: function () {
                callback(false);
              },
              error: function () {
                callback(true);
              }
            });
      }
    });
  }

  function editNote(noteId, messageText, callback) {
    HipChat.auth.withToken(function (err, token) {
      if (!err) {
        //Then, make an AJAX call to the add-on backend, including the JWT token
        //Server-side, the JWT token is validated using the middleware function addon.authenticate()
        $.ajax(
            {
              type: 'PUT',
              url: '/notes/' + noteId,
              headers: {'Authorization': 'JWT ' + token},
              dataType: 'json',
              data: {messageText: messageText},
              success: function () {
                callback(false);
              },
              error: function () {
                callback(true);
              }
            });
      }
    });

  };

  /* Functions used by dialog.hbs */

  //Register a listener for the dialog button - primary action "say Hello"
  HipChat.register({
    "dialog-button-click": function (event, closeDialog) {

      if (event.action === "delete-all.yes") {
        deleteNotes(function (error) {
          if (!error)
            closeDialog(true);
          else
            console.log('Could not send message');
        });
      }

      if (event.action === "delete-all.cancel") {
        closeDialog(true);
      }

      if (event.action === "delete.yes") {
        var noteId = $('.js-delete-note-id').attr('data-id');
        var callback = function(error) {
            if (!error) {
              closeDialog(true);
            }else {
              console.log('Could not send message');
            };
        };

        deleteNote(noteId, callback)
      }

      if (event.action === "delete.cancel") {
        closeDialog(true);
      }

      if (event.action === "edit.save") {
        var newMessageText = $('.js-edit-note-input').val();
        var noteId = $('.js-edit-note-input').attr('data-id');

        var callback = function(error) {
            if (!error) {
              closeDialog(true);
            }else {
              console.log('Could not send message');
            };
        };

        editNote(noteId, newMessageText, callback)
      };

      if (event.action === "edit.cancel") {
        closeDialog(true);
      }
    },

    "receive-parameters": function (parameters = {}){
      switch(parameters.dialog) {
        case 'edit':
          $('.js-edit-note-input').val(parameters.messageText);
          $(".js-edit-note-input").attr("data-id", parameters.id)
          break;
        case 'delete':
          $(".js-delete-note-id").attr("data-id", parameters.id)
          break;
      }
    }
  });

});