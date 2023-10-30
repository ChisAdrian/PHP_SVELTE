<?php
session_start();

if (isset($_SESSION["loggedin"]) == false || $_SESSION['loggedin'] == false) {
    echo json_encode(
        array(
            "stat" => false,
            "Header" => 'user-disconected',
            "Body" => 'user-disconected'
        )
    );
    exit;
}


if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'));
    $queryTXT = $data->query;
} else
    exit;

require_once 'connect_db.php';
$conn = connecbd();

$result = $conn->query($queryTXT);

if ($result === FALSE) {

    echo json_encode(
        array(
            "stat" => false,
            "Header" => $conn->error,
            "Body" => $sql_str
        )
    );

    $conn->close();
    return;
}

$fieldinfo = $result->fetch_fields();
$Body = array();
$Header = array();


foreach ($fieldinfo as $col)
    array_push($Header, $col->name);



while ($row = $result->fetch_array(MYSQLI_NUM)) {
    $rowArray = array();
    foreach ($row as $r) {
        array_push($rowArray, $r);
    }
    array_push($Body, $rowArray);
}
$conn->close();

echo json_encode(
    array(
        "stat" => true,
        "Header" => $Header,
        "Body" => $Body
    )
);

?>