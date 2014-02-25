(function($) {

// Keeps track of editor status during AJAX operations.
var editorStatus = {};

/**
 * Initialize editor libraries.
 *
 * Some editors need to be initialized before the DOM is fully loaded. The
 * init hook gives them a chance to do so.
 */
Drupal.wysiwygInit = function() {
  // This breaks in Konqueror. Prevent it from running.
  if (/KDE/.test(navigator.vendor)) {
    return;
  }
  jQuery.each(Drupal.wysiwyg.editor.init, function(editor) {
    // Clone, so original settings are not overwritten.
    this(jQuery.extend(true, {}, Drupal.settings.wysiwyg.configs[editor]));
  });
};

/**
 * Attach editors to input formats and target elements (f.e. textareas).
 *
 * This behavior searches for input format selectors and formatting guidelines
 * that have been preprocessed by Wysiwyg API. All CSS classes of those elements
 * with the prefix 'wysiwyg-' are parsed into input format parameters, defining
 * the input format, configured editor, target element id, and variable other
 * properties, which are passed to the attach/detach hooks of the corresponding
 * editor.
 *
 * Furthermore, an "enable/disable rich-text" toggle link is added after the
 * target element to allow users to alter its contents in plain text.
 *
 * This is executed once, while editor attach/detach hooks can be invoked
 * multiple times.
 *
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
 */
Drupal.behaviors.attachWysiwyg = {
  attach: function (context, settings) {
    // This breaks in Konqueror. Prevent it from running.
    if (/KDE/.test(navigator.vendor)) {
      return;
    }

    $('.wysiwyg', context).once('wysiwyg', function () {
      if (!this.id || typeof Drupal.settings.wysiwyg.triggers[this.id] === 'undefined') {
        return;
      }
      var $this = $(this);
      var params = Drupal.settings.wysiwyg.triggers[this.id];
      // Get the field id  without any extra number added by drupal_html_id().
      var baseFieldId = (params.field.indexOf('--') === -1 ? params.field : params.field.substr(0, params.field.indexOf('--')));
      for (var format in params) {
        params[format].format = format;
        params[format].trigger = this.id;
        params[format].field = params.field;
        params[format].summary = params.summary;
        // Use the status from a field with the same base id, if known.
        if (params.field != baseFieldId && editorStatus[format] && typeof editorStatus[format][baseFieldId] !== 'undefined') {
          params[format].status = editorStatus[format][baseFieldId];
        }
      }
      var format = 'format' + this.value;
      // Directly attach this editor, if the input format is enabled or there is
      // only one input format at all.
      if ($this.is(':input')) {
        Drupal.wysiwygAttach(context, params[format]);
      }
      // Attach onChange handlers to input format selector elements.
      if ($this.is('select')) {
        $this.change(function() {
          // If not disabled, detach the current and attach a new editor.
          Drupal.wysiwygDetach(context, params[format]);
          format = 'format' + this.value;
          Drupal.wysiwygAttach(context, params[format]);
        });
      }
      // Detach any editor when the containing form is submitted.
      $('#' + params.field).parents('form').submit(function (event) {
        // Do not detach if the event was cancelled.
        if (event.isDefaultPrevented()) {
          return;
        }
        Drupal.wysiwygDetach(context, params[format], 'serialize');
      });
    });
  },

  detach: function (context, settings, trigger) {
    var wysiwygs;
    // The 'serialize' trigger indicates that we should simply update the
    // underlying element with the new text, without destroying the editor.
    if (trigger == 'serialize') {
      // Removing the wysiwyg-processed class guarantees that the editor will
      // be reattached. Only do this if we're planning to destroy the editor.
      wysiwygs = $('.wysiwyg-processed', context);
    }
    else {
      wysiwygs = $('.wysiwyg', context).removeOnce('wysiwyg');
    }
    wysiwygs.each(function () {
      var params = Drupal.settings.wysiwyg.triggers[this.id];
      Drupal.wysiwygDetach(context, params[Drupal.wysiwyg.instances[params.field].format], trigger);
    });
  }
};

/**
 * Attach an editor to a target element.
 *
 * This tests whether the passed in editor implements the attach hook and
 * invokes it if available. Editor profile settings are cloned first, so they
 * cannot be overridden. After attaching the editor, the toggle link is shown
 * again, except in case we are attaching no editor.
 *
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
 * @param params
 *   An object containing input format parameters.
 */
Drupal.wysiwygAttach = function(context, params) {
  if (typeof Drupal.wysiwyg.editor.attach[params.editor] == 'function') {
    var originalField = params.field;
    // Store this field id, so (external) plugins can use it.
    // @todo Wrong point in time. Probably can only supported by editors which
    //   support an onFocus() or similar event.
    Drupal.wysiwyg.activeId = params.field;
    // Attach or update toggle link, if enabled.
    if (params.toggle) {
      Drupal.wysiwygAttachToggleLink(context, params);
    }
    // Otherwise, ensure that toggle link is hidden.
    else {
      $('#wysiwyg-toggle-' + params.field).hide();
    }
    // Attach to main field.
    attachToField(context, params);
    // Attach to summary field.
    if (params.summary) {
      // If the summary wrapper is hidden, attach when it's made visible.
      if ($('#' + params.summary).parents('.text-summary-wrapper').is(':visible')) {
        params.field = params.summary;
        attachToField(context, params);
        params.field = originalField;
      }
      else {
        $('#' + params.field).parents('.text-format-wrapper').find('.link-edit-summary').unbind('click.wysiwyg').bind('click.wysiwyg', function () {
          params.field = params.summary;
          attachToField(context, params);
          params.field = originalField;
          $(this).unbind('click.wysiwyg');
        });
      }
    }
  }
};

/**
 * helper to prepare and attach an editor for a single field.
 */
function attachToField(context, params) {
  // If the editor isn't active, attach default behaviors instead.
  var editor = (params.status ? params.editor : 'none');
  // (Re-)initialize field instance.
  Drupal.wysiwyg.instances[params.field] = {};
  // Provide all input format parameters to editor instance.
  jQuery.extend(Drupal.wysiwyg.instances[params.field], params);
  // Provide editor callbacks for plugins, if available.
  if (typeof Drupal.wysiwyg.editor.instance[editor] == 'object') {
    jQuery.extend(Drupal.wysiwyg.instances[params.field], Drupal.wysiwyg.editor.instance[editor]);
  }
  Drupal.wysiwyg.editor.attach[editor](context, params, (Drupal.settings.wysiwyg.configs[editor] ? jQuery.extend(true, {}, Drupal.settings.wysiwyg.configs[editor][params.format]) : {}));
}

/**
 * Detach all editors from a target element.
 *
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
 * @param params
 *   An object containing input format parameters.
 * @param trigger
 *   A string describing what is causing the editor to be detached.
 *
 * @see Drupal.detachBehaviors
 */
Drupal.wysiwygDetach = function (context, params, trigger) {
  // Do not attempt to detach an unknown editor instance (Ajax).
  if (typeof Drupal.wysiwyg.instances[params.field] == 'undefined') {
    return;
  }
  trigger = trigger || 'unload';
  // Detach from main field.
  detachFromField(context, params, trigger);
  // Detach from summary field.
  if (params.summary && Drupal.wysiwyg.instances[params.summary]) {
    // The "Edit summary" click handler could re-enable the editor by mistake.
    $('#' + params.field).parents('.text-format-wrapper').find('.link-edit-summary').unbind('click.wysiwyg');
    var originalField = params.field;
    params.field = params.summary;
    detachFromField(context, params, trigger);
    params.field = originalField;
  }
};

/**
 * helper to detach and clean up after an editor for a single field.
 */
function detachFromField(context, params, trigger) {
  var editor = (params.status ? Drupal.wysiwyg.instances[params.field].editor : 'none');
  var baseFieldId = (params.field.indexOf('--') === -1 ? params.field : params.field.substr(0, params.field.indexOf('--')));
  editorStatus[params.format] = editorStatus[params.format] || {};
  editorStatus[params.format][baseFieldId] = params.status;
  if (jQuery.isFunction(Drupal.wysiwyg.editor.detach[editor])) {
    Drupal.wysiwyg.editor.detach[editor](context, params, trigger);
  }
  if (trigger == 'unload') {
    delete Drupal.wysiwyg.instances[params.field];
  }
}

/**
 * Append or update an editor toggle link to a target element.
 *
 * @param context
 *   A DOM element, supplied by Drupal.attachBehaviors().
   * @param params
   *   An object containing input format parameters.
   */
  Drupal.wysiwygAttachToggleLink = function(context, params) {
    if (!$('#wysiwyg-toggle-' + params.field).length) {
      var text = document.createTextNode(params.status ? Drupal.settings.wysiwyg.disable : Drupal.settings.wysiwyg.enable);
    var a = document.createElement('a');
    $(a).attr({ id: 'wysiwyg-toggle-' + params.field, href: 'javascript:void(0);' }).append(text);
    var div = document.createElement('div');
    $(div).addClass('wysiwyg-toggle-wrapper').append(a);
    $('#' + params.field).after(div);
  }
  $('#wysiwyg-toggle-' + params.field)
    .html(params.status ? Drupal.settings.wysiwyg.disable : Drupal.settings.wysiwyg.enable).show()
    .unbind('click.wysiwyg', Drupal.wysiwyg.toggleWysiwyg)
    .bind('click.wysiwyg', { params: params, context: context }, Drupal.wysiwyg.toggleWysiwyg);

  // Hide toggle link in case no editor is attached.
  if (params.editor == 'none') {
    $('#wysiwyg-toggle-' + params.field).hide();
  }
};

/**
 * Callback for the Enable/Disable rich editor link.
 */
Drupal.wysiwyg.toggleWysiwyg = function (event) {
  var context = event.data.context;
  var params = event.data.params;
  // Detach current editor.
  Drupal.wysiwygDetach(context, params);
  params.status = !params.status;
  // Attach based on new parameters.
  Drupal.wysiwygAttach(context, params);
  $(this).html(params.status ? Drupal.settings.wysiwyg.disable : Drupal.settings.wysiwyg.enable).blur();
}

/**
 * Parse the CSS classes of an input format DOM element into parameters.
 *
 * Syntax for CSS classes is "wysiwyg-name-value".
 *
 * @param element
 *   An input format DOM element containing CSS classes to parse.
 * @param params
 *   (optional) An object containing input format parameters to update.
 */
Drupal.wysiwyg.getParams = function(element, params) {
  var classes = element.className.split(' ');
  var params = params || {};
  for (var i = 0; i < classes.length; i++) {
    if (classes[i].substr(0, 8) == 'wysiwyg-') {
      var parts = classes[i].split('-');
      var value = parts.slice(2).join('-');
      params[parts[1]] = value;
    }
  }
  // Convert format id into string.
  params.format = 'format' + params.format;
  // Convert numeric values.
  params.status = parseInt(params.status, 10);
  params.toggle = parseInt(params.toggle, 10);
  params.resizable = parseInt(params.resizable, 10);
  return params;
};

/**
 * Allow certain editor libraries to initialize before the DOM is loaded.
 */
Drupal.wysiwygInit();

// Respond to CTools detach behaviors event.
$(document).bind('CToolsDetachBehaviors', function(event, context) {
  Drupal.behaviors.attachWysiwyg.detach(context, {}, 'unload');
});

})(jQuery);
