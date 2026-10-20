<?php
function yukari_node_autoplay_active()
{
    return is_file(dirname(__DIR__) . '/runtime/queue/node-autoplay.owner');
}
