<p>Using https://laragon.org/index.html with Svelte ,PHP with live reload.</p>
inspired from here : 
<href>
  https://dev.to/anthonygushu/how-to-embed-a-svelte-app-within-a-php-application-with-live-reload-1knh
</href>
<p> Some basic PHP Login logout and query to mysql db </p>
<p>Tested via clone npm install , database creation ,etc has to be done in laragon </p>
<p> connect_db.php needs to be has been modified accordingly   </p>
    <table>
      <tr>
      <td> $servername = "?";</td>
        <td> $username = "?";</td>
        <td>   $password = "?";</td>
        <td>  $dbname = "?";</td>
      </tr>
    </table>
   
 
  

<p>
 definitions </p> 
 <p>
CREATE TABLE `accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` mediumblob NOT NULL,
  `assigned` varchar(25) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb3;
</p>
<p>
CREATE TABLE `key` (
  `enc` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin2;
</p>
<p>
INSERT INTO accounts
( username, password, assigned)
VALUES( 'user', (select AES_ENCRYPT('pass', (select enc from `key` ))) , 'admin'); 

</p>
