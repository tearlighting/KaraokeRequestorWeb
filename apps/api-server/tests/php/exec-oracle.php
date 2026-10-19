<?php
// Execute the actual Legacy exec.php against a disposable per-call database.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$case=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$configPath='/var/www/html/config.ini';$originalConfig=file_get_contents($configPath);
$dbName='runtime/queue/.phase8-oracle-'.bin2hex(random_bytes(8)).'.db';$dbPath='/var/www/html/'.$dbName;
register_shutdown_function(function()use($configPath,$originalConfig,$dbPath){file_put_contents($configPath,$originalConfig);foreach([$dbPath,$dbPath.'-wal',$dbPath.'-shm'] as $f)if(is_file($f))unlink($f);});
file_put_contents($configPath,"dbname=\"{$dbName}\"\nusemypage=".(!empty($case['history'])?'1':'0')."\nrequest_automove=".(!empty($case['automove'])?'1':'0')."\nrequest_automove_reset=".(!empty($case['reset'])?'1':'0')."\nrequest_automove_midjoin_first=".(!empty($case['midjoin'])?'1':'0')."\nnonameusername=\"%E5%90%8D%E7%84%A1%E3%81%97%E3%81%95%E3%82%93\"\n");
putenv('YUKARI_NODE_REQUESTS=0');
$_SERVER=['REMOTE_ADDR'=>$case['ip']??'127.0.0.1','HTTP_USER_AGENT'=>$case['ua']??'php-oracle','HTTP_X_REQUESTED_WITH'=>'XMLHttpRequest'];
$_COOKIE=['YkariUserID'=>$case['userid']??'11111111-1111-4111-8111-111111111111','YkariUsername'=>$case['displayname']??''];
$_REQUEST=[];chdir('/var/www/html');require '/var/www/html/commonfunc.php';
$columns=['id','songfile','singer','comment','kind','reqorder','fullpath','nowplaying','status','clientip','clientua','playtimes','secret','loop','keychange','track','pause','audiodelay','duration','volume','song_name','lister_artist','lister_work','lister_op_ed','lister_comment'];
foreach($case['rows']??[] as $row){$row=array_intersect_key($row,array_flip($columns));$names=array_keys($row);$s=$db->prepare('INSERT INTO requesttable('.implode(',',$names).') VALUES('.implode(',',array_fill(0,count($names),'?')).')');$s->execute(array_values($row));}
if(($case['fail']??'')==='history'){
  $db->exec("CREATE TABLE mypage_user(userid TEXT PRIMARY KEY,displayname TEXT DEFAULT '',icon_path TEXT DEFAULT '',created_at INTEGER NOT NULL)");
  $db->exec("CREATE TABLE mypage_history(id INTEGER PRIMARY KEY AUTOINCREMENT,userid TEXT NOT NULL,fullpath TEXT NOT NULL,songfile TEXT NOT NULL,kind TEXT NOT NULL DEFAULT '',requested_at INTEGER NOT NULL)");
  $db->exec("CREATE TRIGGER fail_history BEFORE INSERT ON mypage_history BEGIN SELECT RAISE(ABORT,'oracle history fault'); END");
}
$_REQUEST=$case['input'];if(!array_key_exists('freesinger',$_REQUEST))$_REQUEST['freesinger']='';
$source=str_replace("\r\n","\n",file_get_contents('/var/www/html/exec.php'));
$bootstrap="if (getenv('YUKARI_NODE_REQUESTS') === '1') require __DIR__ . '/api/_request_forward.php';\n\$db = null;\n\nrequire_once 'commonfunc.php';\n";
$source=str_replace($bootstrap,'',$source,$removed);if($removed!==1)throw new RuntimeException('Legacy exec bootstrap changed; review oracle');
$execCopy=$dbPath.'.php';file_put_contents($execCopy,$source);
$output='';$failed=false;ob_start();try{require $execCopy;}catch(Throwable $error){$failed=true;}$output=ob_get_clean();@unlink($execCopy);
$result=json_decode(trim($output),true);$rows=$db->query('SELECT * FROM requesttable ORDER BY id ASC')->fetchAll(PDO::FETCH_ASSOC);
$history=[];$users=[];
if($db->query("SELECT name FROM sqlite_schema WHERE type='table' AND name='mypage_history'")->fetchColumn())$history=$db->query('SELECT userid,fullpath,songfile,kind FROM mypage_history ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
if($db->query("SELECT name FROM sqlite_schema WHERE type='table' AND name='mypage_user'")->fetchColumn())$users=$db->query('SELECT userid,displayname FROM mypage_user ORDER BY userid')->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['id'=>$result['newid']??null,'failed'=>$failed,'rows'=>$rows,'history'=>$history,'users'=>$users],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
$db=null;
