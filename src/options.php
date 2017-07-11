<?php
function ajax_options_save($get_param, $post_param) {
  call_hooks('options_save', $post_param);

  $_SESSION['options'] = $post_param;

  return array('success' => true);
}

if (!array_key_exists('options', $_SESSION)) {
  $_SESSION['options'] = array();
}

html_export_var(array('options' => $_SESSION['options']));
