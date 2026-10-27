<?php
function yukari_node_autoplay_active()
{
    $runtime = dirname(__DIR__) . '/runtime/';
    return is_file($runtime . 'queue-owner/node-autoplay.owner')
        || is_file($runtime . 'queue/node-autoplay.owner'); // isolated SQLite compatibility profile
}
