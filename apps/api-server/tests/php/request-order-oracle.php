<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$cases=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
require dirname(__DIR__,4).'/legacy/php/function_moveitem.php';
$results=[];
foreach($cases as $case){
  $db=new PDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
  $db->exec('CREATE TABLE requesttable(id INTEGER PRIMARY KEY,reqorder INTEGER,singer TEXT,kind TEXT,nowplaying TEXT)');
  foreach($case['rows'] as $row){$s=$db->prepare('INSERT INTO requesttable VALUES(?,?,?,?,?)');$s->execute([$row['id'],$row['reqorder'],$row['singer'],$row['kind'],$row['nowplaying']]);}
  $fresh=$case['fresh'];$s=$db->prepare('INSERT INTO requesttable VALUES(?,?,?,?,?)');$s->execute([$fresh['id'],$fresh['reqorder'],$fresh['singer'],$fresh['kind'],$fresh['nowplaying']]);
  $config_ini=['request_automove_reset'=>$case['reset']?1:0,'request_automove_midjoin_first'=>$case['midjoin']?1:0];
  $move=new MoveItem();$move->getturnlist($db);$target=$move->get_new_reqorder($fresh['id']);$move->insertreqorder($fresh['id'],$target);$move->save_allrequest($db);
  $results[]=$db->query('SELECT id,reqorder FROM requesttable ORDER BY reqorder ASC,id ASC')->fetchAll(PDO::FETCH_ASSOC);
}
echo json_encode($results,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
