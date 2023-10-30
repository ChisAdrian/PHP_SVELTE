<?php
function connecbd()
{
    $servername = "localhost";
    $username = "root";
    $password = "";
    $dbname = "pfollow";
    // Create connection
    $conn = new mysqli($servername, $username, $password, $dbname);
    if ($conn->connect_error) {
        $conn = null;
    }
    return $conn;
}
?>
