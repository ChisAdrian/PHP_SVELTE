<?php

session_set_cookie_params([
    'lifetime' => 0, // Session cookie lasts until the browser is closed
    'path' => '/',
    'domain' => $_SERVER['HTTP_HOST'],
    'secure' => true, // Use HTTPS
    'httponly' => true // Protect against XSS
]);



session_start();
session_regenerate_id(true); // Regenerate session ID


require_once 'connect_db.php';

date_default_timezone_set('Europe/Paris');

function filter_string_polyfill($string)
{
    $str = preg_replace('/\x00|<[^>]*>?/', '', $string);
    return str_replace(["'", '"'], ['&#39;', '&#34;'], $str);
}
;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'));
    $username = filter_string_polyfill($data->username);
    $password = filter_string_polyfill($data->password);
    // Hash and salt the password before storing it
} else
    exit;



$conn = connecbd();

if (is_null($conn)) {
    echo json_encode(array("message" => "Database connection error:"));
    exit;
}


$row_COUNT = 0;
$col_cnt = 0;
$result = $conn->query("call get_psw('" . $username . "')");
$numRows = $result->num_rows;
if ($numRows > 0) {
    foreach ($result as $row) {
       if ($password == $row["psw"])
         {
            $_SESSION['loggedin'] = TRUE;
            $_SESSION['user'] = $username;
            $_SESSION['assigned'] = $row["assigned"];

            echo json_encode(
                array(
                    "stat" => true,
                    "role" => $_SESSION['assigned'],
                    "user" => $username
                )
            );
        } else {
            echo json_encode(array("message" => "Authentication Failed"));
        }
    }
} else {
    echo json_encode(array("message" => "Authentication Failed"));
}
?>