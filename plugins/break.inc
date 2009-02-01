<?php
// $Id$


/**
 * Implementation of hook_wysiwyg_plugin().
 */
function wysiwyg_break_plugin() {
  $plugins = array();
  $plugins['break'] = array(
    'title' => t('Teaser break'),
    'vendor url' => 'http://drupal.org/project/wysiwyg',
    'icon file' => 'break.gif',
    'icon title' => t('Separate the teaser and body of this content'),
    'settings' => array(
      // Path is set by default.
      // 'path' => wysiwyg_get_path('plugins/break', TRUE),
    ),
  );
  return $plugins;
}
