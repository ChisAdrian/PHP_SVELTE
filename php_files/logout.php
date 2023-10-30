<?php
session_start();
echo json_encode(
    array(
        "stat" => false,
        "Header" => 'user-disconected',
        "Body" => 'user-disconected'
    )
);
session_destroy();
?>