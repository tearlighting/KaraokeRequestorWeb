# Legacy PHP 蜈ｼ螳ｹ諤ｧ荳惹ｸ壼苅 Owner・・hase 6・・

譌･譛滂ｼ・026-10-20縲ょｽ灘燕扈滉ｸ API 逧・勸騾・邂｡逅・弌蛻怜所荳我ｸｪ邂｡逅・ｮｾ鄂ｮ隸ｻ蜿門插荳ｺ Node-native・姚egacy swipe 髦溷・鬘ｵ荵滄夊ｿ・峡遶句宵隸ｻ逾ｨ謐ｮ螟咲畑 Node縲１HP 菫晉蕗謗域揀遲也払蜥悟・驛ｨ蟆壽悴霑∫ｧｻ蜀吝・縲１hase 4/5 谿ｵ關ｽ荳ｺ蜴・彰螳｡隶｡・悟ｽ灘燕迥ｶ諤∽ｻ･ Phase 6 Owner 陦ｨ荳ｺ蜃・・

## 逶ｮ蠖穂ｸ・URL

| 螳ｿ荳ｻ譛ｺ菴咲ｽｮ | 螳ｹ蝎ｨ菴咲ｽｮ / 逕ｨ騾・|
| --- | --- |
| `legacy/php/` | 譫・ｻｺ譌ｶ螟榊宛蛻ｰ PHP 髟懷ワ `/var/www/html`・娥ySQL 霑占｡梧慮荳肴撃霓ｽ謨ｴ荳ｪ逶ｮ蠖・|
| `legacy/php/api/` | 蜴・JSON API縲∫ｮ｡逅・る・蝎ｨ縲∝女菫｡ Node Bridge |
| `legacy/php/{js,css,fonts,images,modules,cms,...}` | 蜴溯ｵ・ｺ舌∫ｬｬ荳画婿 PHP 蜿雁次荳壼苅讓｡蝮暦ｼ悟・驛ｨ逶ｸ蟇ｹ蜈ｳ邉ｻ荳榊序 |
| `legacy/php/config.ini`・亥宵隸ｻ蜊墓枚莉ｶ謖りｽｽ・・| PHP 螳ｹ蝎ｨ蜀・宵萓帛次邂｡逅・ｯ・・EasyAuth 隸∵・荳取頗邏｢隶ｾ鄂ｮ隸ｻ蜿厄ｼ妲astify 荳肴撃霓ｽ |
| `legacy/php/List.sqlite3`・亥宵隸ｻ蜊墓枚莉ｶ謖りｽｽ・・| PHP 謳懃ｴ｢逧・髪荳 SQLite 邏｢蠑穂ｾ句､厄ｼ帑ｸ堺ｽ應ｸｺ荳壼苅謨ｰ謐ｮ蠎・|
| `yukari_queue_owner` | PHP `/var/www/html/runtime/queue-owner` 荳・Node `/run/queue-owner`・御ｻ・・莠ｫ閾ｪ蜉ｨ謦ｭ謾ｾ Owner fence |
| `legacy/php/config.ini`縲∝・莉冶ｿ占｡梧枚莉ｶ | 蜴滓悽譛ｺ霑占｡梧枚莉ｶ髫丞ｺ皮畑蜴滓ｷ遘ｻ蜉ｨ・帑ｸ肴弍譁ｰ逕滓・逧・ｻ倩ｮ､蠎捺・驟咲ｽｮ・御ｸ咲ｺｳ蜈･譁ｰ蠅樊署莠､ |
| 莉灘ｺ捺ｹ逶ｮ蠖・| 荳肴撃霓ｽ蛻ｰ豁｣蟶ｸ MySQL PHP/Node 譛榊苅・幃囈遖ｻ SQLite 豬玖ｯ・Compose 蜊慕峡蜿ｪ隸ｻ謖りｽｽ |
| `apps/`縲～packages/`縲～docs/`縲～docker/` | 菫晄戟鬘ｹ逶ｮ郤ｧ逶ｮ蠖包ｼ娟ode 蜿ｪ謖ゆｸ願ｿｰ荳鍋畑髦溷・逶ｮ蠖・|

菫晉蕗逧・Legacy URL `/search.php`縲～/search_bs5.php`縲～/exec.php`縲～/api/search.php`縲～/api/capabilities.php` 荳・`/api/lister_index.php` 荳榊｢槫刈 `/legacy/php` 蜑咲ｼ縲ょ・莉匁悴霑∫ｧｻ PHP 荳壼苅蜈･蜿｣蝨ｨ豁｣蟶ｸ MySQL 讓｡蠑剰ｿ泌屓 410縲ょ・驛ｨ Node Adapter 逧・`LEGACY_PHP_URL=http://web` 荳・`/api/node_bridge.php` 荳榊序縲３eact 莉榊・蛻ｫ蝨ｨ 5173/5174・碁夊ｿ・3000 逧・`/api/v1` 騾壻ｿ｡縲・

霑∫ｧｻ蜑榊●豁｢ PHP/Node・御ｽｿ逕ｨ `git mv` 遘ｻ蜉ｨ蟾ｲ霍溯ｸｪ譌ｧ蠎皮畑・悟ｿｽ逡･逧・ｿ占｡梧枚莉ｶ髫冗岼蠖墓・蜊慕峡蜴滓ｷ遘ｻ蜉ｨ縲・61 荳ｪ譁・ｻｶ霑∫ｧｻ蜑榊錘騾蝉ｸ SHA256 逶ｸ蜷鯉ｼ帶ｸ・黒莉・ｭ俶悽譛ｺ蠢ｽ逡･逧・`.local/phase4-move-hashes.json`縲よｲ｡譛牙唖髯､/驥榊ｻｺ謨ｰ謐ｮ蠎薙・㍾鄂ｮ蟇・∵・菫ｮ謾ｹ schema縲よｹ逶ｮ蠖募ｼょｸｸ `NUL` 菫晄戟蜴溽憾荳泌ｿｽ逡･縲Ａini.ini` 蜴滓怏譛ｪ謠蝉ｺ､蜀・ｮｹ菫晉蕗・帛ｷｲ霍溯ｸｪ逧・INI 荳堺ｼ壼屏 `.gitignore` 閾ｪ蜉ｨ豸亥､ｱ・御ｸ崎・逕ｨ `git add -A` 謚願ｿ占｡御ｿｮ謾ｹ荳襍ｷ謠蝉ｺ､縲・

## Phase 5・哢ode-native 邂｡逅・ｮｾ鄂ｮ隸ｻ蜿・

| 讓｡蝮・| 蠖灘燕扈滉ｸ API Owner | Legacy 鬘ｵ髱｢ Owner / 譚・ｨ∝・蜈･譁ｹ |
| --- | --- | --- |
| `GET /api/v1/settings` | **Node-native** `SettingsService` + `SettingsRepository`・幄ｯｻ蜿・playmode/startvolume/requestlistactivereload 荳取紛譁・ｻｶ SHA256 revision | 蜴・PHP GET 菫晉蕗荳ｺ蜈ｼ螳ｹ/陦御ｸｺ蜿り・ｼ帶ｲ｡譛牙・蜈･ |
| `PUT /api/v1/settings` | Node 譬｡鬪・謗域揀・鍬egacy Adapter 蜊墓ｬ｡隹・畑 | **PHP 蜚ｯ荳隶ｾ鄂ｮ蜀吝・譁ｹ**・悟次 revision 譬｡鬪御ｸ・serializer 荳榊序 |
| 邂｡逅・肢譚・所謦､髞譽譟･ | Node 莨夊ｯ・+ 蜴・PHP 隶､隸∬ｯ∵・譽譟･ | PHP 鬪瑚ｯ∝ｽ灘燕 configpass/UUID/EasyAuth 遲也払・帶ｲ｡譛牙､榊宛蟇・・ｪ瑚ｯ∫ｮ玲ｳ・|
| 髦溷・縲∵眺謾ｾ縲∵頗邏｢縲∫憾諤√∬・蜉帷ｭ牙・菴咎｢・沺 | Node 扈滉ｸ霎ｹ逡鯉ｼ訓HP 荳壼苅螳樒鴫 | PHP・帶悴霑∫ｧｻ/譛ｪ譁ｰ蠅槫・蜈･譁ｹ |

隕・尠隶｡謨ｰ蝗ｺ螳壽潔蠖灘燕扈滉ｸ API 逧・7 邀ｻ鬚・沺 GET 霍ｯ逕ｱ・喞apabilities縲〈ueue縲｝layback縲《earch縲∥dmin/queue縲∥dmin/status縲《ettings縲・*1/7・育ｺｦ 14.3%・牙ｷｲ Node-native**・帑ｸ榊ｰ・頗邏｢荳､荳ｪ backend 蛻・ｼ隶｡謨ｰ・御ｸ榊桁蜷ｫ逋ｻ蠖・莨夊ｯ・health縲ゆｸ壼苅蜀呵ｷｯ逕ｱ莉堺ｸｺ 0/5 Node-native・磯｢・ｺｦ縲∝唖髯､縲∬ｰ・ｺ上∬ｮｾ鄂ｮ縲∵眺謾ｾ謗ｧ蛻ｶ・会ｼ梧園譛牙・蜈･蠖・PHP縲りｿ呎弍霍ｯ逕ｱ隸ｻ蜿冶激蝗ｴ隶｡謨ｰ・御ｸ崎・隗｣驥贋ｸｺ謨ｴ荳ｪ蠎皮畑蟾ｲ霑∫ｧｻ 14.3%縲・

### 騾画叫荳手ｰ・畑體ｾ

髦溷・隸ｻ蜿門桁蜷ｫ螟壽ｬ｡ SQL縲・｡ｺ蠎上∽ｿ晏ｯ・owner・・P/UA/逕ｨ謌ｷ蜷榊ｭ暦ｼ我ｸ主紙蜿ｲ蛻晏ｧ句喧萓晁ｵ厄ｼ帷憾諤・怙隕・Windows/player縲よ立隶ｾ鄂ｮ GET 荵滉ｼ夂ｻ剰ｿ・`_common.php` 竊・`commonfunc.php` 竊・`kara_config.php` 竊・`initdb/updatedb`・悟ｹｶ髱樊裏蜑ｯ菴懃畑隸ｻ蜿悶・ode 隸ｻ蜿紋ｸ我ｸｪ隶ｾ鄂ｮ逧・激蝗ｴ譛蟆擾ｼ御ｸ埼怙隕・SQLite縲・

譁ｰ體ｾ霍ｯ・夂ｮ｡逅・ｼ夊ｯ晄｣譟･ 竊・PHP `admin-session` 莉・ｪ瑚ｯ∝ｽ灘燕隸∵・蟷ｶ霑泌屓 config_revision 竊・Node 蜿ｪ隸ｻ蜊墓枚莉ｶ縲∵｡鬪瑚ｯ･ revision縲∫峡遶区兜蠖ｱ蜿願激蝗ｴ譬｡鬪・竊・蜀肴ｬ｡鬪瑚ｯ∬ｯ∵・荳・revision 竊・霑泌屓譌｢譛・Settings縲１HP 逧・session 蛻・髪蝨ｨ蜉霓ｽ蜈ｬ蜈ｱ荳壼苅莉｣遐∝燕騾蜃ｺ・御ｸ榊・蟋句喧謨ｰ謐ｮ蠎難ｼ帑ｸ崎ｰ・畑 `admin-settings`縲∽ｸ堺ｻ・PHP 蜿門ｾ苓ｮｾ鄂ｮ蟄玲ｮｵ縲る囈遖ｻ豬玖ｯ慕噪謗域揀髣ｨ豐｡譛芽ｮｾ鄂ｮ荳壼苅螳樒鴫・君ode 莉崎ｿ泌屓逵溷ｮ樊枚莉ｶ謚募ｽｱ・碁ｪ瑚ｯ∝・迢ｬ遶区ｧ縲・

`SettingsRepository` 蜿ｪ謠蝉ｾ帛宵隸ｻ蠢ｫ辣ｧ・梧ｲ｡譛牙・蟒ｺ/蜀吝・/菫ｮ螟肴婿豕包ｼ幄ｷｯ蠕・罰譛榊苅遶ｯ `LEGACY_SETTINGS_PATH` 蝗ｺ螳壻ｸ泌ｿ・｡ｻ扈晏ｯｹ・御ｸ肴磁蜿玲ｵ剰ｧ亥勣霍ｯ蠕・・ode 豐｡譛・SQLite 鬩ｱ蜉ｨ縲∵焚謐ｮ蠎鍋岼蠖墓・ WAL mount縲りｯｻ蜿匁弍蜊穂ｸｪ Buffer・罫evision 蜥悟ｭ玲ｮｵ譚･閾ｪ逶ｸ蜷悟ｭ苓鰍・梧裏郛灘ｭ倥・ocker 莉・ｰ・鴫譛・`config.ini` 蜿ｪ隸ｻ謖りｽｽ蛻ｰ `/run/legacy-settings/config.ini`・幃・鄂ｮ豐｡譛芽ｿ帛・髟懷ワ縲∫識蠅・序驥上∵ｵ玖ｯ墓枚莉ｶ謌匁律蠢励・ode 霑帷ｨ句屏豁､譁ｰ蠅槫ｯｹ謨ｴ荳ｪ蜴・INI 逧・ｯｻ蜿匁揀髯撰ｼ悟次蟋句ｭ苓鰍蜿ｪ蝨ｨ隸ｷ豎ょ・螟・炊・悟桃蠎比ｸ･譬ｼ髯仙宛荳ｺ荳牙ｭ玲ｮｵ蜿雁嶋蟶鯉ｼ帑ｸ榊ｾ怜ｰ・ｭ､逶ｮ蠖募★髱呎∵恪蜉｡謌匁滑驟咲ｽｮ蜉蜈･隸頑妙霎灘・縲・

### 遲我ｻｷ闌・峩荳取・遑ｮ蟾ｮ蠑・

- 菫晄戟蜴・`Settings` 螂醍ｺｦ縲・ｻ倩ｮ､蛟ｼ 3/50/1縲￣HP 蟶ｸ隗・INI 蟶・ｰ比ｸ取焚蛟ｼ霓ｬ謐｢縲∫ｼｺ逵・遨ｺ蛟ｼ縲・㍾螟埼｡ｹ譛蜷主ｼ縲・撼蛻・鰍隸ｻ蜿悶，RLF縲〉evision 蟄苓鰍蜩亥ｸ悟柱蜴・API 闌・峩郤ｦ譚溘・7 扈・囈遖ｻ霎灘・騾蝉ｸ荳主次 PHP 謚募ｽｱ豈碑ｾ・・
- PHP oracle 莉守鴫譛・`api/admin.php` 謠仙叙螳樣刔謚募ｽｱ隸ｭ蜿･謇ｧ陦鯉ｼ御ｸ肴焔謚・悄譛帷ｮ玲ｳ包ｼ帛宵蜉霓ｽ蜷域・霎灘・/隸ｷ豎ょ・蜿ｪ隸ｻ蠢ｫ辣ｧ・御ｸ・include 蜈ｬ蜈ｱ蜷ｯ蜉ｨ蝎ｨ縲∽ｸ崎ｿ樊磁 SQLite縲∽ｸ崎ｧｦ遒ｰ逵溷ｮ樣・鄂ｮ縲よｵ玖ｯ穂ｸｭ螳梧紛驟咲ｽｮ蜿ｪ扈・stdin 迸ｬ譌ｶ莨騾抵ｼ瑚ｾ灘・莉・區蜷榊黒蟄玲ｮｵ荳主嶋蟶鯉ｼ梧裏蜃ｭ謐ｮ莠ｧ迚ｩ縲・
- 蜿ｪ謾ｯ謖∝ｽ灘燕 serializer 逧・黒陦梧・㍼隶ｾ鄂ｮ譬ｼ蠑擾ｼ帷岼譬・焚扈・∝黒蠑募捷/蠑慕畑 key縲￣HP 蟶ｸ驥上∬｡ｨ霎ｾ蠑上∫識蠅・薯蛟ｼ縲∫音谿願ｽｬ荵・螟夊｡檎ｭ我ｸ榊惠遲我ｻｷ螢ｰ譏主・・梧・遑ｮ霑泌屓 `503 SETTINGS_UNAVAILABLE`・御ｸ榊屓騾 PHP縲∽ｸ咲懸豬区・蜉溘ゆｿ晉蕗逧・次 PHP 蜿ｯ閭ｽ謗･蜿苓ｿ吩ｺ帶ｼ蠑擾ｼ幄ｿ呎弍蟾ｲ隶ｰ蠖慕噪螟ｱ雍･蜈ｳ髣ｭ蟾ｮ蠑ゑｼ御ｸ榊ｮ｣遘ｰ螳梧紛螟榊綾 PHP INI 隗｣驥雁勣縲・
- 譌ｧ PHP 驟咲ｽｮ蜀吝・豐｡譛蛾煤謌門次蟄先崛謐｢縲よ悽谺｡蜑榊錘迚域悽豈碑ｾ・・諡堤ｻ晁ｧょｯ溷芦逧・序蛹門柱螟ｱ謨・inode 謖りｽｽ・御ｸ崎・隸∵・豐｡譛俄懷・蜈･證ょ●譛滄龍諱ｰ螂ｽ荳､谺｡隸ｻ蛻ｰ逶ｸ蜷御ｸｭ髣ｴ譁・ｻｶ窶晉噪遯怜哨・帶ｲ｡譛牙滓悽髦ｶ谿ｵ謾ｹ蜀吝次驟咲ｽｮ writer縲ょ錘扈ｭ蜴溷ｭ宣・鄂ｮ蜿大ｸ・蜊丈ｽ憺煤髴迢ｬ遶区隼騾縲・
- 謇句ｷ･ atomic replace/驥榊多蜷肴崛謐｢ config.ini 蜿ｯ閭ｽ莉､ Docker 蜊墓枚莉ｶ bind 菫晉蕗譌ｧ inode・娜HP revision 荳・Node 譁・ｻｶ荳榊源驟榊叉 503・梧鴬陦・`docker compose -f docker/compose.yaml up -d --force-recreate api-server` 諱｢螟肴撃霓ｽ縲ゆｸ堺ｽｿ逕ｨ譌ｧ蛟ｼ扈ｧ扈ｭ謌仙粥蜩榊ｺ斐ょｮｹ蝎ｨ驥榊ｻｺ菴ｿ蜴溷・蟄・Node 莨夊ｯ晏､ｱ謨茨ｼ碁怙驥肴眠逋ｻ蠖輔・
- 隶ｾ鄂ｮ譌謗貞ｺ乗・逕ｨ謌ｷ豁梧峇菫晏ｯ・ｦょｿｵ・帷嶌蜈ｳ蟇ｹ辣ｧ鬪瑚ｯ・・鄂ｮ驥榊､埼｡ｹ蜿雁ｭ玲ｮｵ鬘ｺ蠎乗裏蜈ｳ諤ｧ縲∫區蜷榊黒霎灘・荳榊桁蜷ｫ蟇・・鬚晏､門ｭ玲ｮｵ縲る弌蛻玲賜蠎丞柱菫晏ｯ・ｵ玖ｯ慕ｻｧ扈ｭ逕ｱ邇ｰ譛臥悄螳樣寔謌・E2E 蝗槫ｽ定ｦ・尠・御ｸ榊｣ｰ遘ｰ蟾ｲ霑∫ｧｻ髦溷・縲・

邂｡逅・ｫｯ蜴・`/api/v1/settings` GET 蟾ｲ閾ｪ蜉ｨ蛻・困蛻ｰ Node 螳樒鴫・訓UT 荳榊序・妣dge 鬚晏､夜ｪ瑚ｯ・GET 逧・`X-Yukari-Owner: node-settings-read` 譬・ｮｰ縲よ勸騾・user-web 豐｡譛臥ｮ｡逅・ｮｾ鄂ｮ蜉溯・・悟・莉｣逅・所譛榊苅遶ｯ譚・剞扈ｴ謖∵拠扈昴・

譌ｧ `/init.php` 荳取立 JS 荳榊・謐｢・咤asic/EasyAuth 霄ｫ莉ｽ荳崎・螳牙・閾ｪ蜉ｨ譏蟆・芦 Node 邂｡逅・ｼ夊ｯ晢ｼ御ｸ碑ｮ､隸∝錘逧・立隶ｾ鄂ｮ GET 閾ｪ霄ｫ蜿ｯ閭ｽ蠎丞・蛹夜・鄂ｮ縲・pache 莉榊宵莉｣逅・・蠑蛛･蠎ｷ迥ｶ諤・ｼ梧悴蠑謾ｾ譌ｧ遶ｯ蜿｣ `/api/v1/settings`縲∵悴譁ｰ蠅・8080 邂｡逅・Origin縲∵悴蠑募・ PHP 竊・Node 隹・畑縲よ立蜿ｪ隸ｻ螳樒鴫荳ｺ蜈ｼ螳ｹ菫晉蕗・御ｸ榊ｼ募・隨ｬ莠御ｸｪ蜀吝・譁ｹ縲・

### 譛ｬ髦ｶ谿ｵ鬪瑚ｯ∫ｻ捺棡

荳我ｸｪ鬘ｹ逶ｮ typecheck/build 騾夊ｿ・ｼ佞ompose 螳樣刔驥榊ｻｺ蜷ｯ蜉ｨ・・00 荳ｪ Legacy PHP 隸ｭ豕墓｣譟･縲・3 + 5 鬘ｹ蜴溯ｮ､隸∵｣譟･蜿・oracle PHP 隸ｭ豕暮夊ｿ・・PI 豬玖ｯ募・ 8 鬘ｹ騾夊ｿ・ｼ瑚ｦ・尠荳願ｿｰ 17 扈・兜蠖ｱ縲∵眠蠅樔ｸ肴髪謖∵ｼ蠑上∵枚莉ｶ郛ｺ螟ｱ/迚域悽蜀ｲ遯√・囈遖ｻ謗域揀髣ｨ逧・彫髞/蟷ｶ蜿大序蛹悶∫悄螳樣・鄂ｮ蠢ｫ辣ｧ遲我ｻｷ縲∵揀髯・Origin 荳主次蜀呎桃菴懷屓蠖偵ら悄螳・Edge・嗽ser-web 5 騾夊ｿ・・ 霍ｳ霑・ｼ域峇蠎灘多荳ｭ譛ｪ驟咲ｽｮ・会ｼ径dmin-web 3 騾夊ｿ・ょ次髦溷・貂・炊蜷主屓隸ｻ荳閾ｴ・慶onfig.ini/ini.ini 逧・次蟄苓鰍菫晉蕗縲・

蜈ｨ譁ｰ蟾･菴懷玄豐｡譛・config.ini 譌ｶ・御ｸ･譬ｼ蜿ｪ隸ｻ蜊墓枚莉ｶ mount 荳堺ｼ壽崛逕ｨ謌ｷ逕滓・驟咲ｽｮ・壼・ `docker compose -f docker/compose.yaml up --build -d web`・悟惠蜴溯ｮｾ鄂ｮ鬘ｵ驟咲ｽｮ蟷ｶ菫晏ｭ倡ｮ｡逅・ｯ・・ｼ悟・謇ｧ陦悟ｮ梧紛 `up --build -d`縲ょｷｲ譛蛾・鄂ｮ逧・ｽ灘燕蟾･菴懷玄莉堺ｸｺ荳譚｡ Compose 蜻ｽ莉､蜷ｯ蜉ｨ縲よ悽譛ｺ Node 蠑蜿大ｿ・｡ｻ蟆・`LEGACY_SETTINGS_PATH` 謖・髄邇ｰ譛蛾・鄂ｮ逧・ｻ晏ｯｹ霍ｯ蠕・ｼ御ｸ榊､榊宛驟咲ｽｮ謌匁滑蜈ｶ蜀・ｮｹ謾ｾ蜈･ `.env`縲・

## 隹・畑縲∝･醍ｺｦ荳主憶菴懃畑

荳玖｡ｨ荳ｭ逧・Node 霍ｯ蠕・插莉･ `/api/v1` 荳ｺ蜑咲ｼ縲や懆ｾｹ逡悟ｷｲ扈滉ｸ窶晁｡ｨ遉ｺ React 菴ｿ逕ｨ Node 蜀咲罰 Bridge 隹・畑 PHP・御ｸ崎｡ｨ遉ｺ荳壼苅蟾ｲ謾ｹ蜀吩ｸｺ Node縲ょ次 PHP 逧・揀髯先緒霑ｰ譏ｯ邇ｰ迥ｶ螳｡隶｡・御ｸ崎・蠖謎ｽ懈眠 API 逧・肢譚・ｦ∵ｱゅ・

| 譌ｧ蜈･蜿｣ / 隹・畑閠・| 蜴滓婿豕穂ｸ主盾謨ｰ縲∝桃蠎・| 荳壼苅 Owner / 蜑ｯ菴懃畑 | Node 謗･蜿｣荳取揀髯・| 譌ｧ鬘ｵ髱｢霑∫ｧｻ迥ｶ諤・|
| --- | --- | --- | --- | --- |
| `/index.php`縲～/requestlist_top.php` | GET・幄ｷｳ霓ｬ閾ｳ蜴滄弌蛻・HTML | PHP 鬘ｵ髱｢荳主ｯｼ闊ｪ | 譌譖ｿ莉｣ | 菫晉蕗 |
| `/search.php` 竊・`/search_bs5.php` | GET `searchword`縲～order`縲～start`縲～orderby`縲～scending`縲～selectid`・姨TML | PHP Everything 謗貞ｺ・霑・ｻ､・帛庄蜀呎頗邏｢蜴・彰譌･蠢・| `/search?backend=everything&keyword=...` GET・蛍ser 莨夊ｯ・| 蜴滄｡ｵ髱｢逶ｴ霑・PHP・娚eact 霎ｹ逡悟ｷｲ扈滉ｸ |
| `/searchfilefromkeyword_json.php` | GET 譟･隸｢蜿よ焚・帛ｱ慕､ｺ逕ｨ JSON 荳ｭ蜷ｫ HTML | PHP Everything 謳懃ｴ｢縲∽ｼ伜・郤ｧ蜿雁ｱ慕､ｺ扈・｣・| 蜷御ｸ奇ｼ帶ｲ｡譛蛾仙ｭ玲ｮｵ遲我ｻｷ譖ｿ謐｢ | 菫晉蕗・御ｸ榊ｰ・HTML 蠖捺眠螂醍ｺｦ |
| `/api/search.php` | `api_param` 謗･蜿・GET/POST・嫣keyword` 蠢・｡ｫ・形order/path` 蜿ｯ騾会ｼ嫣{ok,data:{keyword,total,count,items}}` | PHP 蜴・Everything 譟･隸｢・悟庄髯・刈譖ｲ蠎・worker | `/search` GET・妣verything 荳榊庄霎ｾ 503 | 菫晉蕗・娟ode Bridge 蝗ｺ螳夊ｰ・畑 |
| `/search_listerdb*.php` | 鬘ｵ髱｢/JSON 蟄仙・蜿｣・嫣anyword` 遲会ｼ瑚ｯｦ隗∵枚莉ｶ豕ｨ驥・| PHP YukaLister 蜴滓衍隸｢・御ｾ晁ｵ也鴫譛牙ｺ難ｼ帛庄閭ｽ郛ｺ陦ｨ螟ｱ雍･ | `/search?backend=lister&keyword=...` GET・蛍ser | 菫晉蕗邂玲ｳ穂ｸ取立譟･隸｢・御ｸ堺ｿｮ蠎・|
| `/request_confirm*.php`縲～/request.php` | GET/POST 譁・ｻｶ縲∵ｭ梧焔遲会ｼ帷｡ｮ隶､ HTML | PHP 鬚・ｺｦ遑ｮ隶､・御ｸ咲ｭ我ｺ主ｷｲ蜈･蠎・| React 逶ｴ謗･螻慕､ｺ遑ｮ隶､迥ｶ諤・| 菫晉蕗 |
| `/exec.php` | 蜴溯｡ｨ蜊暮得 POST・井ｻ｣遐∽ｽｿ逕ｨ `$_REQUEST`・会ｼ嫣filename/fullpath/singer/freesinger/comment/kind`・形secret` 蜿ｯ騾会ｼ婢HR `{newid}`・悟・莉匁ｨ｡蠑・HTML/霍ｳ霓ｬ | PHP 蜚ｯ荳鬚・ｺｦ蜀吝・譁ｹ・嗷equesttable縲・｡ｺ蠎上∝紙蜿ｲ縲・夂衍・帛・謨ｰ謐ｮ譟･隸｢蜿ｯ閭ｽ蝨ｨ謠蝉ｺ､蜷主､ｱ雍･ | `/requests` POST JSON・蛍ser・・01 `{ok:true,data:{id}}`・帑ｸ崎・蜉ｨ驥崎ｯ・| 譌ｧ陦ｨ蜊穂ｻ咲峩謗･ PHP・御ｸ咲ｻ・Node 蝗樒識 |
| `/requestlist_swipe_json.php`縲～/requestlist_table_json.php`縲～/requestlist_json.php`縲～/requestlist_xml.php` | GET・帛ｱ慕､ｺ JSON/XML・悟・菴灘ｭ玲ｮｵ荳榊酔 | PHP 髦溷・荳惹ｿ晏ｯ・・鄂ｩ | `/queue` GET・蛍ser・帷ｻ滉ｸ `QueueData` | 蜴溽ｫｯ轤ｹ菫晉蕗・孕wipe 鬘ｵ逕ｱ Node 霑泌屓蜈ｼ螳ｹ譬ｼ蠑・|
| `/api/requests.php` | GET/POST 蜿よ焚 `limit/offset` 蜿ｯ騾会ｼ嫣{ok,data:{items,total,has_more,remaining_count,remaining_seconds}}` | PHP `build_requestlist_data`・罫eqorder 髯榊ｺ擾ｼ経wner 驕ｮ鄂ｩ | `/queue`縲～/admin/queue` GET・悟・蛻ｫ user/admin | 蜴溷・蜿｣菫晉蕗・娚eact 髦溷・蟾ｲ逕ｱ Node 逶ｴ謗･譟･隸｢ |
| `/requestlist_event.php`縲～/updaterequestlist.php` | SSE / 蜴溷姐譁ｰ蜈･蜿｣ | PHP 譖ｴ譁ｰ騾夂衍蜥碁弌蛻怜姐譁ｰ | 譌 Node-native 莠倶ｻｶ豬・| 菫晉蕗・帛紙蜿ｲ SSE 驟咲ｽｮ髣ｮ鬚俶悴蝨ｨ譛ｬ髦ｶ谿ｵ謾ｹ蜀・|
| `/delete.php`縲～/api/request_delete.php` | 蜴・UI 蜿よ焚蛻・髪・妍SON 蜈･蜿｣謗･蜿・`id`・梧・蜉・`{ok,data:{id,deleted:true}}` | PHP 蛻髯､縲］ormalize_reqorder縲・夂衍 | `/admin/requests/:id` DELETE・径dmin・帛宵隹・畑 PHP 荳谺｡ | 菫晉蕗譌ｧ隶ｿ髣ｮ隗・・・帶眠霎ｹ逡悟ｼｺ蛻ｶ admin |
| `/api/request_move.php`縲∝次 `/delete.php` 隹・ｺ丞・謾ｯ | `id`縲～action=up/down/warikomi`・嫣{ok,data:{id,action,message}}` | PHP `dbup/dbdown/warikomi`縲∝ｽ剃ｸ蛹悶・夂衍 | `/admin/requests/:id/move` POST JSON・径dmin | 菫晉蕗蜴・UI・御ｸ肴隼謗貞ｺ剰ｧ・・ |
| `/requestlist_reorder.php` | 蜴滓許諡ｽ謗貞ｺ剰｡ｨ蜊募盾謨ｰ蜿雁桃蠎・| PHP 謇ｹ驥城｡ｺ蠎丞・蜈･ | 譌謇ｹ驥・Node 霍ｯ逕ｱ | 菫晉蕗・悟ｰ壽悴霑∫ｧｻ |
| `/init.php` | GET 邂｡逅・HTML・娜OST 螳梧紛蜴溯ｮｾ鄂ｮ陦ｨ蜊・| PHP 菫晉蕗譌ｧ鬘ｵ/隶ｾ鄂ｮ菫晏ｭ假ｼ娟ode 雍溯ｴ｣扈滉ｸ API 荳蛾｡ｹ隸ｻ蜿悶ょｷｲ隶､隸・GET 荵溷庄閭ｽ蠎丞・蛹夜・鄂ｮ蜿・ini.ini・悟屏豁､譛ｪ荳ｺ鬪梧噺謇ｧ陦瑚ｯ･ GET | `/settings` GET/PUT・径dmin・帑ｻ・playmode/startvolume/requestlistactivereload + revision | 蜴溷ｮ梧紛隶ｾ鄂ｮ菫晉蕗・軍eact 莉・ｸ我ｸｪ蟄玲ｮｵ・姆ET 蟾ｲ Node-native縲￣UT 莉・PHP |
| `/api/admin.php?operation=...` | session/queue/status/settings 荳ｺ GET・嫖elete/move/settings-save/player 荳ｺ POST form-urlencoded・帷ｻ滉ｸ PHP envelope | PHP 阮・る・蝎ｨ螟咲畑蜴溷・謨ｰ・帛・蜈･莉榊ｽ・PHP | `/admin/session`縲～/admin/status`縲∫ｮ｡逅・弌蛻励∬ｮｾ鄂ｮ縲∵眺謾ｾ蝎ｨ蟄宣寔・嫗dmin | 譌ｧ Phase 2 謗･蜿｣菫晉蕗・梧悴蜷第勸騾夂畑謌ｷ莉｣逅・|
| `/get_playingstatus_json.php`縲～/playingsong.php`縲～/api/nowplaying.php`縲～/api/playstatus.php` | GET 迥ｶ諤・JSON/HTML・帑ｸ榊酔譌ｧ譬ｼ蠑・| PHP 蜴滓眺謾ｾ迥ｶ諤・ｼ御ｾ晁ｵ・Windows/謦ｭ謾ｾ蝎ｨ荳主・謨ｰ謐ｮ | `/playback` GET・蛍ser・嫣/admin/status` GET・径dmin | 菫晉蕗・御ｸ咲罰蜑咲ｫｯ謗ｨ譁ｭ蠖灘燕譖ｲ逶ｮ |
| `/mpcctrl*.php`縲～/foobarctl*.php`縲～/api/player.php`縲～/player_event.php` | 蜴・action/player/髻ｳ驥・蜻ｽ莉､遲会ｼ帶立 HTML/JSON | PHP MPC-BE/foobar 謗ｧ蛻ｶ・悟庄閭ｽ螳樣刔蠖ｱ蜩肴眺謾ｾ謌夜弌蛻・| `/playback/control` POST・径dmin・帛宵蜈∬ｮｸ mpc/foobar 荳・play/pause/playpause/stop 蟄宣寔 | 蜴溷・螳ｹ蜈･蜿｣莉肴怏謨茨ｼ娜hase 9 譁ｰ蟒ｺ迢ｬ遶・mpv Agent 豬玖ｯ暮得霍ｯ・御ｸ肴崛謐｢霑吩ｺ帶立謗･蜿｣ |
| `/api/capabilities.php` | GET・嫻eatures 遲芽・蜉・JSON | PHP 扈・ｻｶ/譛榊苅閭ｽ蜉帶爾豬・| `/capabilities` GET・蛍ser | 菫晉蕗 |
| `/api/server_info.php` | GET・嫣{ok,data:{app,version,easyauth_required}}`・瑚ｮ､隸∝燕蜿ｯ隸ｻ | PHP 蠎皮畑迚域悽荳・EasyAuth 遲也払・帛ｹｶ髱樒ｺｯ Node 迥ｶ諤・| 譌遲我ｻｷ Node-native 譖ｿ謐｢ | 菫晉蕗・帑ｸ肴響 Node 霑帷ｨ狗沿譛ｬ莨ｪ陬・ｺ皮畑迚域悽 |
| `/mypage*.php`縲～/api/mypage.php` | 螟夂ｧ・action縲「serid縲∵噺阯・蜴・彰/蜷梧ｭ･蟄玲ｮｵ・姨TML/JSON | PHP 逕ｨ謌ｷ縲∝紙蜿ｲ縲∵噺阯上＾Auth/Drive・帛庄閭ｽ蜀吝ｺ・螟夜Κ譛榊苅 | 譌蟇ｹ蠎皮ｻ滉ｸ Node 霍ｯ逕ｱ | 譛ｪ霑∫ｧｻ |
| `/api/file_details.php`縲～/api/song_metadata.php`縲～/api/lister_index.php` | 隗∝推遶ｯ轤ｹ豕ｨ驥顔噪霍ｯ蠕・邏｢蠑募盾謨ｰ・妍SON | PHP 蜈・焚謐ｮ/髻ｳ霓ｨ/Lister 邏｢蠑・| 譌蟇ｹ蠎・Node-native 讓｡蝮・| 譛ｪ霑∫ｧｻ |
| `/listimport.php`縲～/listexport*.php`縲～/simplelist*.php` | 蜴滉ｸ贋ｼ/蟇ｼ蜈･蟇ｼ蜃ｺ蜿よ焚・姨TML/譁・ｻｶ | PHP 譖ｲ蠎薙・弌蛻怜ｯｼ蜈･蟇ｼ蜃ｺ・悟庄閭ｽ蜀咏悄螳樊焚謐ｮ | 譌譁ｰ螳樒鴫 | 菫晉蕗・帶悴謇ｧ陦檎悄螳槫ｯｼ蜈･ |
| `/edit_*.php`縲～/song_metadata_edit_bs5.php`縲～/metadata_correction_csv.php` | 蜴滄・鄂ｮ/蜈・焚謐ｮ陦ｨ蜊墓・ CSV | PHP 蜴・JSON/譖ｲ蠎・莨伜・郤ｧ蜀吝・ | 譌譁ｰ螳樒鴫 | 菫晉蕗・梧悴豬玖ｯ慕悄螳樣・鄂ｮ蜿俶峩 |
| `/backup_restore.php` | Basic 邂｡逅・ｮ､隸・ｼ嫗ction=download縲‥b/bgimg 蜿ｯ騾会ｼ梧△螟堺ｸｺ荳贋ｼ陦ｨ蜊・| PHP 螟・ｻｽ/諱｢螟榊庄隕・尠驟咲ｽｮ蜥悟ｺ・| 譌譁ｰ螳樒鴫 | 霍ｯ蠕・・邉ｻ菫晉蕗・帶悴謇ｧ陦梧△螟・|
| `/online_update.php` | ACTION 謌・UPDATEVERSION/METHOD | 蜴溷黒菴・Git/ZIP 譖ｴ譁ｰ蜿ｯ閭ｽ隕・尠貅千∵・ reset | 譌譁ｰ螳樒鴫 | monorepo 荳区・遑ｮ諡堤ｻ・Git/ZIP/GC/蛻晏ｧ句喧蜀吝・・帶隼逕ｨ莉灘ｺ馴Κ鄂ｲ |
| `/cms/`縲～/notfoundrequest/`縲～/ddns/`縲∽ｸ玖ｽｽ荳贋ｼ縲｜ingo縲～/v2/` | 蜷・次鬘ｵ髱｢/JS 陦ｨ蜊募刻隶ｮ | 蜈ｨ驛ｨ PHP/譌ｧ JS・幃Κ蛻・・蠎捺・萓晁ｵ門､夜Κ鄂醍ｻ・Windows | 譌譁ｰ螳樒鴫 | 謨ｴ菴謎ｿ晉蕗・梧悴螳｣遘ｰ荳壼苅蟾ｲ霑∫ｧｻ |
| 譁ｰ譌ｧ鬘ｵ `/api/v1/meta/health` | GET・梧裏蜿よ焚・嫣{ok:true,data:{service:'yukari-api',version:'v1'}}` | **Node-native**・帑ｸ崎ｰ・畑 PHP縲∽ｸ崎ｯｻ蠎薙∽ｸ榊・蟒ｺ莨夊ｯ・| 蜈ｬ蠑縲∝宵隸ｻ縲∵裏蜃ｭ謐ｮ | 譌ｧ鬘ｵ JS 蟾ｲ蛻・困・帑ｻ・渕遑隶ｾ譁ｽ迥ｶ諤・ｼ御ｸ崎ｮ｡荳壼苅隕・尠 |

蜴・JSON 螟ｱ雍･騾壼ｸｸ `{ok:false,error:蟄礼ｬｦ荳ｲ}`・君ode 蛻・`{ok:false,error:{code,message,requestId?,legacyStatus?,legacyReason?}}`縲ゆｸ榊ｾ怜ｯｹ譌ｧ鬘ｵ髱｢蜈ｨ螻譖ｿ謐｢ fetch URL・悟屏荳ｺ蜩榊ｺ斐∫憾諤∫√｛wner 蜥悟・蜈･隸ｭ荵牙ｹｶ荳咲ｭ我ｻｷ縲るΚ蛻・懷宵隸ｻ窶・PHP include 莨壼・蟋句喧蠎・陦･蜈・焚謐ｮ・帶悽髦ｶ谿ｵ豐｡譛牙ｼ募・ Node SQLite 逶ｴ隸ｻ謌匁眠逧・WAL/髞∫ｭ也払縲・

## 譛蛾剞蜷梧ｺ・Adapter 荳手ｺｫ莉ｽ髫皮ｦｻ

`print_meta_header()` 蝨ｨ Compose 逧・`YUKARI_MONOREPO=1` 荳句刈霓ｽ `/js/node-status.js`縲り・譛ｬ蜿ｪ隸ｷ豎ょ崋螳・`/api/v1/meta/health`・瑚ｶ・慮 5 遘抵ｼ形credentials: omit`・帛､ｱ雍･譏ｾ遉ｺ荳榊庄霎ｾ・梧立 PHP 謳懃ｴ｢/髦溷・莉榊庄菴ｿ逕ｨ縲よｲ｡譛・PHP 譛榊苅遶ｯ HTTP 隸ｷ豎・Node縲・

Apache 莉・ｰ・*邊ｾ遑ｮ蛛･蠎ｷ霍ｯ蠕・*莉｣逅・芦蝗ｺ螳・`http://api-server:3000`・郁ｿ樊磁雜・慮 2 遘偵∵ｻ雜・慮 5 遘抵ｼ会ｼ御ｸｻ蜉ｨ蜴ｻ謗・Authorization/Cookie・悟・菴・`/api/v1` 蝨ｨ譌ｧ遶ｯ蜿｣霑泌屓 403縲りｯ･蜈ｬ蠑遶ｯ轤ｹ豐｡譛芽ｺｫ莉ｽ謌也畑謌ｷ謨ｰ謐ｮ・悟屏閠梧裏髴蜀・Κ逕ｨ謌ｷ霄ｫ莉ｽ譏蟆・り凶譛ｪ譚･髴隕∽ｻ｣逅・怏霄ｫ莉ｽ蜉溯・・碁｡ｻ蜿ｦ陦瑚ｮｾ隶｡隶､隸∽ｸ・Origin 遲也払・御ｸ崎・謇ｩ螳ｽ豁､莉｣逅・・豺ｻ蜉蜿ｯ莨ｪ騾隗定牡 Header縲・

Fastify 逧・admin Origin 逋ｽ蜷榊黒豐｡譛画眠蠅・8080・檎ｮ｡逅・ｼ夊ｯ昴∝ｯ・∬ｯ∵・縲，SRF 譬・ｮｰ縲？ttpOnly Cookie 蜥・Bridge 譛榊苅蜃ｭ謐ｮ譬｡鬪悟・驛ｨ菫晉蕗縲ょ次 Basic 邂｡逅・遭荳堺ｼ夊・蜉ｨ闔ｷ蠕・Node 莨夊ｯ晢ｼ娚eact 逧・Node 莨夊ｯ昜ｸ堺ｼ夊｢ｫ譌ｧ UI 蛟溽畑縲ょ▼蠎ｷ隸ｷ豎ゆｸ崎ｿ泌屓 Set-Cookie縲・pache 蜷梧慮遖∵ｭ｢荳玖ｽｽ INI/DB/WAL/SHM/journal/譌･蠢・遘・徴縲・

隹・畑蝗ｾ蜿ｪ譛我ｸ画擅・・

```text
React UI -> Node /api/v1 -> trusted PHP Bridge -> PHP business
Legacy UI -> original PHP business
Legacy status JS -> Apache exact health proxy -> Node-native health
```

蛛･蠎ｷ handler 荳榊ｼ慕畑 Legacy Adapter・梧裏 PHP -> Node -> PHP 騾貞ｽ偵よ立蜀吝・蜿｣豐｡譛画困霍ｯ逕ｱ・君ode 荵滉ｸ埼㍾隸・螟榊宛蜀吝・縲・

## 霍ｯ蠕・ｮ｡隶｡

| 讓｡蠑・/ 譁・ｻｶ | 螟・炊荳手ｾｹ逡・|
| --- | --- |
| `api/{_common,admin,node_bridge,server_info}.php` 逧・`chdir(dirname(__DIR__))` | 莉崎ｧ｣譫蝉ｸｺ螳梧紛 PHP 譬ｹ逶ｮ蠖包ｼ佞LI 霑占｡悟ｺ皮畑譌ｶ荵滄｡ｻ莉･ `legacy/php/` 荳ｺ CWD |
| `__DIR__` / `dirname(__FILE__)`・夊レ譎ｯ蝗ｾ縲∫ｼ灘ｭ倥∬｡･蛛ｿ JSON縲∽ｼ伜・郤ｧ JSON縲∝､・ｻｽ縲；oogle relay | 萓晁ｵ匁枚莉ｶ髫丞ｺ皮畑遘ｻ蜉ｨ・悟・驛ｨ螻らｺｧ荳榊序・帶悴謾ｹ蜃ｭ謐ｮ謌夜・鄂ｮ蛟ｼ |
| 驟咲ｽｮ荳ｭ逧・嶌蟇ｹ SQLite 霍ｯ蠕・所 journal/WAL | 謨ｴ荳ｪ逶ｮ蠖・bind mount・梧ｲ｡譛蛾蝉ｸｪ謨ｰ謐ｮ蠎捺枚莉ｶ mount・帶焚謐ｮ蠎謎ｸ取浴譁・ｻｶ蜷檎岼蠖輔よｹ逶ｮ蠖募ｷｲ譛我ｸ､荳ｪ遨ｺ List.sqlite3・亥性蠑ょｸｸ譁・ｻｶ蜷搾ｼ牙次譬ｷ菫晉蕗蝨ｨ譁ｰ菴咲ｽｮ・梧ｲ｡譛我ｿｮ蠎・|
| `getcwd()` | manage-mpc 莉・仞遉ｺ・帛次荳ｻ蜈･蜿｣蝨ｨ DocumentRoot・悟ｭ先ｨ｡蝮玲ｲｿ逕ｨ蜴・chdir/include 蜈ｳ邉ｻ |
| `DOCUMENT_ROOT` | 譛ｬ蠎皮畑閾ｪ譛・PHP 譛ｪ蜿醍鴫萓晁ｵ冶ｯ･蛟ｼ逧・眠遑ｬ郛也・ｼ妁pache 莉堺ｸｺ `/var/www/html`・悟宵謾ｹ蜿伜ｮｿ荳ｻ謖りｽｽ譚･貅・|
| Windows 扈晏ｯｹ霍ｯ蠕・・verything縲》asklist縲｀PC/foobar縲。AT/VBS | 豐｡譛画隼蜀咎・鄂ｮ謌匁頗邏｢邂玲ｳ輔Ｄmd/l-smash/謦ｭ謾ｾ蝎ｨ髯・ｱ樊枚莉ｶ逶ｸ蟇ｹ螻らｺｧ菫晉蕗・帛､夜Κ C:\\縲々AMPP/nginx 蛹・ｸ・ｱ莉埼怙 Windows 邇ｰ蝨ｺ驟咲ｽｮ・梧悽 Linux Docker 荳肴髪謖∫悄螳樊眺謾ｾ |
| 譌ｧ Git/ZIP updater 逧・`.git` 蜥・archive-root 蛛・ｮｾ | monorepo 荳区仞蠑城仆豁｢謇ｧ陦鯉ｼ御ｸ崎・謚・Git 譬ｹ逶ｮ蠖墓隼蛻ｰ荳雁ｱょ錘扈ｧ扈ｭ霑占｡梧立 reset/checkout |
| Inno Setup | 閼壽悽髫乗立蠎皮畑遘ｻ蜉ｨ・姚ICENSE/README 逧・Source 謾ｹ荳ｺ `../../` 鬘ｹ逶ｮ譁・ｻｶ縲よ悴蝨ｨ Windows 謇灘桁謌匁鴬陦悟ｮ芽｣・|
| 豬玖ｯ穂ｸｭ逧・・鄂ｮ/隶､隸∵ｺ占ｷｯ蠕・| TS 豬玖ｯ募宵莉・`legacy/php/config.ini` 迸ｬ譌ｶ隸ｻ蜿厄ｼ娜HP guard 豬玖ｯ穂ｻ・`/workspace/apps/...` 蜉霓ｽ `legacy/php/api/...` |

蟾ｲ譛芽ｿ占｡碁・鄂ｮ/INI 蜥悟紙蜿ｲ髫丈ｻ灘ｺ捺声蟶ｦ逧・pfwd PPK 荳肴眠逕滓・縲∽ｸ肴遠蜊ｰ縲∽ｸ埼㍾鄂ｮ・娜PK 荳肴弍譁ｰ蠅樒噪 Bridge 蜃ｭ謐ｮ・粂TTP 荳玖ｽｽ蟾ｲ遖∵ｭ｢縲ょ紙蜿ｲ莉灘ｺ捺声蟶ｦ蟇・徴逧・琉鬚倬怙迢ｬ遶狗｡ｮ隶､逕ｨ騾・霓ｮ謐｢・御ｸ崎・莉･遘ｻ蜉ｨ逶ｮ蠖募ｮ｣遘ｰ蟾ｲ豸磯勁蜴・彰豕・愆縲・ridge 蜃ｭ謐ｮ莉堺ｻ・惠蜴・Docker 遘∵怏 volume・梧悴霑帛・ Legacy 貅千∫岼蠖輔・

## 譛ｬ谺｡鬪瑚ｯ・

- 荳我ｸｪ鬘ｹ逶ｮ typecheck/build 騾夊ｿ・ｼ佞ompose 螳樣刔 build/up 謌仙粥縲・
- PHP 蜈ｨ驥・300 譁・ｻｶ隸ｭ豕暮夊ｿ・ｼ帑ｿｮ螟榊次荳贋ｼ鬘ｵ `<? php` 髞呵ｯｯ・帛・蟄倩ｮ､隸∵｣譟･ 13 + 5 鬘ｹ騾夊ｿ・・
- 逵溷ｮ・API 4 鬘ｹ騾夊ｿ・ｼ壼次謗･蜿｣ URL縲∝▼蠎ｷ譁ｰ譌ｧ蜩榊ｺ比ｸ閾ｴ縲∵立莉｣逅・拠扈晞撼逋ｽ蜷榊黒縲∵撫諢滓枚莉ｶ諡堤ｻ昴∬ｮ､隸・CSRF/莨ｪ騾霄ｫ莉ｽ諡堤ｻ昴∵裏蜿悟・縲∬ｰ・ｺ丞唖髯､縲∝次髦溷・蝗櫁ｯｻ荳閾ｴ縲∬ｮｾ鄂ｮ譌蜿伜喧菫晏ｭ倥・
- user-web Edge・・ 騾夊ｿ・・ 霍ｳ霑・ｼ育悄螳樊峇蠎灘多荳ｭ譛ｪ驟咲ｽｮ・峨ょ桁蜷ｫ譌ｧ謳懃ｴ｢鬘ｵ螳樣刔蜉霓ｽ蛛･蠎ｷ迥ｶ諤∝所 Node 迥ｶ諤∬ｯｷ豎ょ､ｱ雍･謠千､ｺ・帛､ｱ雍･豬玖ｯ暮夊ｿ・ｵ剰ｧ亥勣荳ｭ豁｢鄂醍ｻ懆ｯｷ豎よｨ｡諡滓妙郤ｿ・梧ｲ｡譛我ｼｪ騾謌仙粥蜩榊ｺ斐・
- admin-web Edge・・ 騾夊ｿ・ｼ瑚ｦ・尠逵溷ｮ樒匳蠖輔∵ｵ玖ｯ戊ｮｰ蠖戊ｰ・ｺ・蛻髯､縲∬ｮｾ鄂ｮ譌蜿伜喧菫晏ｭ伜柱謦ｭ謾ｾ蝎ｨ荳榊庄霎ｾ縲・
- 豬玖ｯ募宵譁ｰ蠅樒峡遶区ｵ玖ｯ暮｢・ｺｦ・掲inally 貂・炊蟷ｶ豈碑ｾ・次髦溷・・幄ｮ｡謨ｰ/蛹ｿ蜷肴ｵ玖ｯ慕畑謌ｷ豐ｿ逕ｨ Phase 3 逧・撼謨ｴ蠎灘屓貊夂ｭ也払縲る・鄂ｮ蜥悟次 ini.ini 蜀・ｮｹ蜩亥ｸ御ｿ晄戟霑∫ｧｻ蜑堺ｸ閾ｴ縲・

蜿ｯ驥榊､榊多莉､・井ｻ灘ｺ捺ｹ逶ｮ蠖包ｼ会ｼ・

```powershell
docker compose -f docker/compose.yaml up --build -d
docker compose -f docker/compose.yaml exec -T web php /workspace/docker/check-php.php
docker compose -f docker/compose.yaml exec -T web php /workspace/apps/api-server/tests/php/auth-check.php
docker compose -f docker/compose.yaml exec -T web php /workspace/apps/admin-web/tests/php/admin-auth-check.php
npm.cmd --prefix apps/api-server run build
npm.cmd --prefix apps/user-web run build
npm.cmd --prefix apps/admin-web run build
npm.cmd --prefix apps/api-server test
npm.cmd --prefix apps/user-web run test:e2e
npm.cmd --prefix apps/admin-web run test:e2e
```

蟆壽悴鬪瑚ｯ∫悄螳槫ｪ剃ｽ捺眺謾ｾ縲仝indows 螳芽｣・勣縲∝､・ｻｽ諱｢螟阪∝ｮ樣刔隶ｾ鄂ｮ蛟ｼ蜿俶峩蜥悟､夜Κ OAuth/Drive/DDNS縲よ立 PHP 逧・ｮｽ譚ｾ蜴・彰譚・剞萓晉┯蟄伜惠・御ｻ・悽譛ｺ證ｴ髴ｲ・帶ｲ｡譛画滑蛛･蠎ｷ騾る・隗・ｸｺ譌ｧ蜀呎磁蜿｣螳牙・蜉蝗ｺ縲ゆｸ倶ｸ髦ｶ谿ｵ蠎泌・騾画叫逵滓ｭ｣蜿ｯ迢ｬ遶玖ｿ∫ｧｻ逧・宵隸ｻ鬚・沺・悟・螳壻ｹ画眠譌ｧ螂醍ｺｦ荳主・謐ｮ霎ｹ逡鯉ｼ帑ｸ壼苅霑∫ｧｻ蜑咲ｻｧ扈ｭ逕ｱ PHP 迢ｬ蜊蜀吝・縲・


## Phase 6・壼ｷｲ驛ｨ鄂ｲ逧・Node-native 髦溷・

| 霍ｯ逕ｱ/讓｡蝮・| 蠖灘燕 Owner / 螂醍ｺｦ | 譚・剞荳主憶菴懃畑 |
| --- | --- | --- |
| GET /api/v1/queue | Node SQLite + QueueService・御ｿ晄戟 QueueData/蜈ｫ蟄玲ｮｵ QueueItem | user 莨夊ｯ晢ｼ帛次蜿嶺ｿ｡隸∵・鬪瑚ｯ・ｼ碁・鄂ｩ髱・owner 遘伜ｯ・焚謐ｮ |
| GET /api/v1/admin/queue | Node SQLite + QueueService・悟酔荳螂醍ｺｦ | admin 莨夊ｯ晢ｼ梧勸騾夂畑謌ｷ謌冶ｧ定牡螟ｴ荳崎・蜊・ｺｧ・帛次遲也払蜿伜喧謦､髞 |
| GET /api/v1/legacy/queue?limit&offset | Node 蜷御ｸ Service・鍬egacyQueueData 螳梧紛螻慕､ｺ蟄玲ｮｵ | 莉・ｸ鍋畑 HMAC 隸ｻ蜿也･ｨ謐ｮ・・0 遘偵！P/UA/隗定牡/逕ｨ騾・驟咲ｽｮ遲也払扈大ｮ・|
| POST /api/queue_ticket.php | PHP 蜴・EasyAuth/髱樒ｩｺ Basic 邂｡逅・ｪ瑚ｯ・ｼ帶裏髦溷・ SQL | 蜷梧ｺ・JSON + X-Yukari-Client・粂ost/Origin 逋ｽ蜷榊黒・帑ｸ肴磁蜿苓ｧ定牡/IP 蜿よ焚 |
| Bridge queue-context / legacy-queue-context | PHP 隶､隸・驟咲ｽｮ謨ｰ謐ｮ・御ｸ榊刈霓ｽ蜈ｬ蜈ｱ荳壼苅蜷ｯ蜉ｨ蝎ｨ | 遘∵怏譛榊苅蜃ｭ謐ｮ + 蜴滉ｼ夊ｯ晁ｯ∵・謌紋ｸ鍋畑逾ｨ謐ｮ・帑ｸ肴衍隸｢髦溷・ |
| initdb/updatedb縲∝・謨ｰ謐ｮ蜀吶仝AL/SHM 逕溷多蜻ｨ譛・| PHP 逕溷多蜻ｨ譛溷所蜴溷・體ｾ | Native GET 荳肴鴬陦・DDL縲〉epair縲…heckpoint 謌冶｡･蜈・焚謐ｮ |
| 鬚・ｺｦ縲∝唖髯､縲∬ｰ・ｺ上∬ｮｾ鄂ｮ菫晏ｭ倥∵眺謾ｾ蝎ｨ | PHP 蜚ｯ荳荳壼苅蜀吝・譁ｹ | Node 蜿ｪ蜊墓ｬ｡霓ｬ蜿托ｼ鍬egacy 莉榊次隹・畑 |

豐ｿ逕ｨ Phase 5 逧・7 邀ｻ鬚・沺 GET 蛻・ｯ搾ｼ・/7・・2.9%・牙ｷｲ Native・嘔ueue縲∥dmin/queue縲《ettings・帛・螳ｹ霍ｯ逕ｱ荳埼㍾螟崎ｮ｡謨ｰ縲ゆｺ皮ｱｻ荳壼苅蜀吩ｻ・0/5 Native縲よ立 PHP 隸ｻ蜿也ｫｯ轤ｹ荳ｺ蜈ｼ螳ｹ/陦御ｸｺ蜿り・ｿ晉蕗・御ｸ咲ｭ我ｺ取眠蠅槫・ Owner縲・

### 謨ｰ謐ｮ蠎謎ｸ主ｿｫ辣ｧ

扈冗畑謌ｷ譏守｡ｮ蜷梧э・悟●譛榊ｰ・次 request.db 蜴滓ｷ遘ｻ蛻ｰ legacy/php/runtime/queue/request.db・瑚ｿ∫ｧｻ蜑榊錘 SHA256 逶ｸ蜷鯉ｼ檎悄螳・config.ini 蜿ｪ菫ｮ謾ｹ dbname 霍ｯ蠕・ｼ梧悴謾ｹ蟇・∵・ Schema縲よ悴螟榊宛逕滉ｺｧ蠎薙ょ次謨ｴ Legacy 逶ｮ蠖墓撃霓ｽ陲ｫ閾ｪ蜉ｨ螳｡謇ｹ諡堤ｻ晏錘豐｡譛画鴬陦鯉ｼ帶怙扈・Node 蜿ｪ謖ゆｸ鍋畑 queue 逶ｮ蠖包ｼ亥・譬ｸ蜿ｪ隸ｻ・峨￣hase 5 蜴滓怏驟咲ｽｮ蜊墓枚莉ｶ・亥宵隸ｻ・牙柱 Bridge 遘∵怏 volume縲ゆｸ肴撃霓ｽ蜈ｶ莉・Legacy 貅千√∫ｧ・徴謌冶ｿ占｡檎岼蠖輔Ｓuntime 逧・HTTP 隶ｿ髣ｮ謨ｴ菴鍋ｦ∵ｭ｢縲・

QueueRepository 驟咲ｽｮ扈晏ｯｹ譬ｹ逶ｮ蠖募ｹｶ realpath 髦ｲ雜顔阜・孑eadOnly/query_only縲・50ms busy timeout縲∝黒荳 BEGIN/COMMIT・檎ｻ溯ｮ｡/蜈ｨ驛ｨ謗貞ｺ剰｡梧擂閾ｪ荳閾ｴ蠢ｫ辣ｧ縲よ焚謐ｮ蠎謎ｸ・WAL/SHM 蜷檎岼蠖募庄隗・ｼ梧裏 immutable縲∵ｴｻ霍・ｺ楢｣ｸ螟榊宛謌也ｬｬ莠梧焚謐ｮ讓｡蝙九よｯ乗ｬ｡譁ｰ霑樊磁・御ｸ咲ｼ灘ｭ假ｼ幄ｷｯ蠕・ｻ・PHP 逵溷ｮ樣・鄂ｮ蠕怜芦荳秘剞莠主ｷｲ謖りｽｽ逶ｮ蠖包ｼ御ｸ肴磁蜿玲ｵ剰ｧ亥勣譁・ｻｶ霍ｯ蠕・らｼｺ陦ｨ縲∵此蝮上。LOB縲・煤謌紋ｸ榊庄隸ｻ蠎捺・遑ｮ螟ｱ雍･・御ｸ榊・蜈・ｩｺ扈捺棡縲・

蜴溷ｺ捺戟荵・星逕ｨ WAL・御ｽ・洒霑樊磁蜈ｳ髣ｭ蜿ｯ閭ｽ遘ｻ髯､譌∵枚莉ｶ縲１HP 螳ｹ蝎ｨ逧・queue-wal-anchor.php 莉･ www-data縲［ode=rw 霑樊磁**蟾ｲ蟄伜惠**逧・ｺ難ｼ悟宵隸ｻ sqlite_schema・檎ｻｴ謖・WAL/SHM・御ｸ肴戟譛蛾柄莠句苅縲∽ｸ肴隼 journal mode/Schema/荳壼苅謨ｰ謐ｮ縲よ浴譁・ｻｶ蛻晏ｧ句喧譏守｡ｮ逕ｱ PHP 逕溷多蜻ｨ譛溯ｴ溯ｴ｣・娟ode 蜿ｪ隸ｻ謖りｽｽ荳崎執蠕怜・譚・剞縲り凶 anchor 荳榊庄逕ｨ荳疲浴譁・ｻｶ貂・勁・君ative 髦溷・謚･ 503・御ｸ榊ｿｽ逡･ WAL縲よ眠 Docker 螳芽｣・ｻ倩ｮ､荳鍋畑逶ｮ蠖包ｼ帛ｷｲ蟄伜惠譌ｧ蠎謎ｸ崎｢ｫ蜷ｯ蜉ｨ閼壽悽閾ｪ蜉ｨ遘ｻ蜉ｨ・碁撼 Docker Legacy 莉堺ｿ晉蕗蜴滄ｻ倩ｮ､霍ｯ蠕・・

### 陦御ｸｺ遲我ｻｷ荳主玄蛻ｫ

菫晉蕗 reqorder DESC・育嶌蜷碁｡ｺ蠎丞ｼ荳肴套蜉谺｡蠎擾ｼ峨｝osition=total-offset-index縲〕imit=0 蠢ｽ逡･遲幃我ｽ・ｿ晉蕗 offset 蟇ｹ position 逧・紙蜿ｲ菴懃畑縲Ｓemaining_count/seconds 蜿ｪ扈溯ｮ｡譛ｪ蜀咲函/1・慧uration>0・梧潔 PHP 謨ｴ謨ｰ隸ｭ荵芽ｽｬ謐｢・嫺mpty('0')/遨ｺ謦ｭ謾ｾ譬・ｮｰ騾蝗・'1'縲りｿ呎弍謨ｰ謐ｮ蠎捺眺謾ｾ譬・ｮｰ・御ｸ崎ｰ・畑謦ｭ謾ｾ蝎ｨ謌冶・陦悟愛螳壼ｮ樣刔謦ｭ謾ｾ縲・

owner = 蜷御ｸ髱樒ｩｺ clientip+clientua・梧・隸･霄ｫ莉ｽ莉主・驥・DESC 蜿崎ｽｬ蜷朱ｦ匁擅蛹ｹ驟崎ｮｰ蠖・singer 逧・酔蜷崎ｮｰ蠖輔３eact 菴ｿ逕ｨ PHP 謇隗・Bridge IP + Node 荳ｺ逕ｨ謌ｷ蛻・・逧・髪荳 UA・姚egacy 菴ｿ逕ｨ遲ｾ蜷咲噪螳樣刔豬剰ｧ亥勣 IP/UA・御ｸ崎・諡ｿ UUID Cookie 蠖楢∵ｵ剰ｧ亥勣霄ｫ莉ｽ縲よ悴謦ｭ謾ｾ遘伜ｯ・噪 display_name 菫晉蕗蜊菴搾ｼ碁撼譛ｬ莠ｺ髱樒ｮ｡逅・遭霑俶ｸ・勁 songfile/蜈・焚謐ｮ/fullpath・嫩omment/singer 扈ｴ謖∝次 PHP 陦御ｸｺ縲・egacy 蜷・IP+UA 謌門酔蜷咲噪蜴・彰蜈ｱ莠ｫ owner 陦御ｸｺ荳肴隼騾荳ｺ譁ｰ雍ｦ蜿ｷ讓｡蝙九・

PHP 螳樣刔 builder 蜥悟次 username helpers 蝨ｨ迢ｬ遶句・蟄・SQLite 荳頑鴬陦鯉ｼ御ｸ榊刈霓ｽ逵溷ｮ樣・鄂ｮ/蜈ｬ蜈ｱ蜷ｯ蜉ｨ蝎ｨ縲・ode 遲我ｻｷ豬玖ｯ戊ｦ・尠遨ｺ髦溷・縲∵賜蠎・蛻・｡ｵ/驥榊､・reqorder縲∵悽莠ｺ/蜷悟錐/髯檎函/admin縲∝ｼょｸｸ譬・㍼縲ょ次 PHP 螟壽ｬ｡ SQL 豐｡譛臥ｻ滉ｸ蠢ｫ辣ｧ・君ode 逧・ｹｶ蜿台ｸ閾ｴ諤ｧ譏ｯ譏守｡ｮ謾ｹ霑幢ｼ孩orker/WAL 豬玖ｯ穂ｿ晁ｯ・total縲〉ecords縲〉emaining 閨壼粋蜷悟ｱ樔ｸ荳ｪ蠢ｫ辣ｧ縲ょ次隸ｻ蜿門・蜿｣髯・ｸｦ逧・initdb/updatedb 遲牙・菴懃畑荳榊∞陬・ｶ亥､ｱ・壼ｮ・ｻｬ扈ｧ扈ｭ螻樔ｺ・PHP 逕溷多蜻ｨ譛・蜀咎得・君ode 郛ｺ蟆大㊥螟・･ｽ逧・ｺ捺慮螟ｱ雍･・御ｸ崎・蜉ｨ謾ｹ逵溷ｮ・Schema縲・

### Legacy 螳牙・謗･蜈･

蟾ｲ蛻・困 requestlist_swipe.php 逧・ｺ泌､・・陦ｨ蜉霓ｽ/蛻ｷ譁ｰ・刑UKARI_NODE_QUEUE=1 蜷ｯ逕ｨ・帛・莉・JSON/XML 譌ｧ鬘ｵ髱｢莉堺ｿ晉蕗蜴溷ｮ樒鴫縲よｵ剰ｧ亥勣蜈亥酔貅仙叙蠕礼洒譌ｶ逾ｨ謐ｮ・悟・隸ｷ豎らｲｾ遑ｮ /api/v1/legacy/queue縲ら･ｨ謐ｮ莉・ｯｷ豎ょ・蟄・閾ｪ螳壻ｹ牙､ｴ・御ｸ榊ｭ・Cookie/localStorage/URL・御ｸ咲ｼ灘ｭ伜ｯ・√よ勸騾夊ｧ定牡螟ｴ縲￣HP_AUTH_USER 蜷咲ｧｰ謌・Node Cookie 荳崎・闔ｷ蠕・admin・帷ｮ｡逅・遭遲ｾ蜿大ｿ・｡ｻ譬｡鬪悟次螳樣刔髱樒ｩｺ蟇・・ｼ梧裏 localhost 蜈肴｣縲る・鄂ｮ遲也払蜿伜喧逕ｱ PHP 豈乗ｬ｡鬪瑚ｯ∵彫髞縲・

Apache 莉・ｻ｣逅・health/legacy-queue・悟悉謗・Basic/Cookie・娟ode JS credentials:omit縲ゆｻ・ｸ鍋畑 Legacy 隸ｻ蜿冶ｷｯ逕ｱ謗･蜿玲立鬘ｵ Origin・軍eact 邂｡逅・ｷｯ逕ｱ逋ｽ蜷榊黒荳肴黄螳ｽ縲ら･ｨ謐ｮ荳榊・蟒ｺ Node admin session・御ｸ榊庄逕ｨ莠守ｮ｡逅・・ API縲よｲ｡譛・PHP 譛榊苅遶ｯ隸ｷ豎・Node・御ｹ滓ｲ｡譛・Node 隹・次 PHP 髦溷・荳壼苅・悟屏豁､譌蠕ｪ邇ｯ縲∵裏蜿悟・縲よ眠隸ｻ蜿門､ｱ雍･譏ｾ遉ｺ髞呵ｯｯ・御ｸ埼撕鮟伜屓騾縲よ悴蠑蜷ｯ譬・ｿ礼噪迢ｬ遶・Legacy 驛ｨ鄂ｲ莉榊次譬ｷ霑占｡後・

### 鬪瑚ｯ∽ｸ取悴隕・尠

荳我ｸｪ鬘ｹ逶ｮ typecheck/build縲・03 Legacy PHP 隸ｭ豕輔・3+5 蜴溯ｮ､隸∵｣譟･蜿・helper PHP 隸ｭ豕暮夊ｿ・・PI 14 鬘ｹ騾夊ｿ・ｼ孛ser-web Edge 6 騾夊ｿ・・ 霍ｳ霑・ｼ育悄螳樊峇蠎難ｼ会ｼ嫗dmin-web Edge 3 騾夊ｿ・ら悄螳・Legacy PHP 鬚・ｺｦ蜊ｳ譌ｶ蜿ｯ隗・ｼ経wner/荳榊酔 UA 髯檎函莠ｺ驕ｮ鄂ｩ豁｣遑ｮ・悟次 swipe_json 荳榊・隸ｷ豎ゑｼ帷ｮ｡逅・ｰ・ｺ・蛻髯､莉・PHP 蜊募・蟷ｶ逕ｱ Node蝗櫁ｯｻ縲ょ次髦溷・蟾ｲ諱｢螟榊次 id=3/reqorder=1・梧ｵ玖ｯ戊ｮｰ蠖募所荳鍋畑蜴・彰貂・炊・幄・蠅櫁ｮ｡謨ｰ/蛹ｿ蜷肴ｵ玖ｯ慕畑謌ｷ蜿ｯ閭ｽ菫晉蕗・御ｸ榊屓貊壽紛蠎薙・

螟ｧ蝙矩弌蛻玲ｧ閭ｽ縲∫悄螳槫ｪ剃ｽ捺眺謾ｾ蜥梧園譛・Legacy 鬘ｵ髱｢蟆壽悴隕・尠・娶AL helper 譏ｯ霑占｡御ｾ晁ｵ厄ｼ・health 莉・ｿ帷ｨ句▼蠎ｷ縲ょ次 config.ini 髱槫次蟄仙・遯怜哨莉肴弍 Phase 5 髯仙宛・梧悽髦ｶ谿ｵ豐｡譛画黄螟ｧ遐皮ｩｶ縲８indows縲∵頗邏｢蜥梧眺謾ｾ蝎ｨ莉榊次萓晁ｵ悶ょ盾閠・[Node 24 SQLite API](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)縲・


## Phase 7・夂ｮ｡逅・遭髦溷・蜀吝・ Owner 蛻・困

譌･譛滂ｼ・026-10-20縲ゆｻ･荳倶ｸｺ蠖灘燕驛ｨ鄂ｲ隗・・・瑚ｦ・尠蜑肴枚 Phase 1窶・ 逧・紙蜿ｲ Owner 迥ｶ諤√・

| 闌・峩 | 蠖灘燕 Owner / 霍ｯ蠕・| 譚・剞縲∝憶菴懃畑荳主・螳ｹ迥ｶ諤・|
| --- | --- | --- |
| DELETE `/api/v1/admin/requests/:id` | **Node-native** QueueMutationService/Repository | 蜴・Node admin 莨夊ｯ昴＾rigin縲゛SON/CSRF縲￣HP 蠖灘燕隸∵・譬｡鬪鯉ｼ帑ｻ・唖髯､ requesttable・御ｸ榊唖蜴・彰・御ｸ榊●豁｢謦ｭ謾ｾ蝎ｨ |
| POST `/api/v1/admin/requests/:id/move` | **Node-native**・嫣{action:up/down/warikomi}` | 荳主唖髯､逶ｸ蜷梧揀髯撰ｼ幄ｿ泌屓 `{id,action,message}`・御ｿ晉蕗霎ｹ逡梧律譁・署遉ｺ |
| 蠖剃ｸ蛹・| Node 邂｡逅・ｺ句苅蜀・Κ | `reqorder ASC,id ASC` 莉・1 郛門捷・娜HP 蛻帛ｻｺ閾ｪ蜉ｨ謨ｴ蛻嶺ｻ肴弍蛻帛ｻｺ莠句苅逧・ｸ驛ｨ蛻・ｼ御ｸ肴弍隨ｬ莠御ｸｪ邂｡逅・遭隹・ｺ丞・蜿｣ |
| 譖ｴ譁ｰ騾夂衍 | PHP notification-only Bridge | queue-notify 鬪瑚ｯ・Bridge 蜃ｭ謐ｮ蜿雁ｽ灘燕 admin proof・悟宵蜉霓ｽ蜴・UpdateNotice・幄ｮ｡謨ｰ `<50000` 蜉荳・悟凄蛻吝ｽ帝峺・帑ｸ・include commonfunc/髦溷・ SQL |
| 蛻帛ｻｺ/譖ｿ謐｢縲∬・蜉ｨ霓ｮ謐｢縲∝・謨ｰ謐ｮ縲∝紙蜿ｲ縲∵眺謾ｾ譬・ｮｰ | PHP | 菫晉蕗 exec.php 蜥檎函蜻ｽ蜻ｨ譛滂ｼ帑ｸ榊ｭ伜惠窶懈園譛画焚謐ｮ蠎灘・蜈･蝮・ｿ∝芦 Node窶晉噪螢ｰ譏・|
| 隶ｾ鄂ｮ PUT / 謦ｭ謾ｾ謗ｧ蛻ｶ | PHP | 譛ｪ霑∫ｧｻ |

隸ｻ霍ｯ逕ｱ Native 莉堺ｸｺ 3/7縲ゆｺ皮ｱｻ蜀呵ｷｯ逕ｱ・亥・蟒ｺ縲∝唖髯､縲∫ｧｻ蜉ｨ縲∬ｮｾ鄂ｮ縲∵眺謾ｾ謗ｧ蛻ｶ・我ｸｭ **2/5 逧・弌蛻嶺ｸｻ莠句苅荳ｺ Node-native**・幃夂衍莉榊､咲畑 PHP・御ｸ肴滑豁､隶｡謨ｰ逅・ｧ｣荳ｺ螳悟・鞫・┳ PHP縲・ative 蜀吝桃蠎泌桁蜷ｫ `X-Yukari-Owner: node-queue-mutation`・娚eact 隸ｷ豎りｷｯ蠕・柱莠､莠剃ｸ榊序縲・

### 蜴溯｡御ｸｺ荳取・遑ｮ蟾ｮ蠑・

蜴・API 蛻髯､・壼ｭ伜惠諤ｧ譽譟･ 竊・DELETE・育峡遶区署莠､・俄・ normalize・亥嘗荳莠句苅・俄・ notify縲ょ次 move・壽衍驍ｻ螻・竊・菴ｿ逕ｨ荳ｴ譌ｶ reqorder=9999 逧・ｸ画ｬ｡ UPDATE 莠句苅・詣arikomi 蜿ｯ蜿榊､崎ｰ・畑 竊・normalize 蜊慕峡莠句苅 竊・notify縲・ode 蟆・衍謇ｾ縲∝唖髯､/蜈ｨ驛ｨ莠､謐｢縲］ormalize 謾ｾ蝨ｨ荳荳ｪ `BEGIN IMMEDIATE`・恵usy_timeout=1000ms・帛､ｱ雍･謨ｴ菴・ROLLBACK・梧裏閾ｪ蜉ｨ驥崎ｯ輔ゆｿ晉蕗髣ｴ髫疲衍驍ｻ螻・∝酔蛟ｼ謖牙次譟･隸｢騾画叫縲∝次荳ｴ譌ｶ 9999 遒ｰ謦櫁｡御ｸｺ蜥・normalize 逧・id 谺｡蠎上・

warikomi 莉・滑蟄礼ｬｦ荳ｲ `譛ｪ蜀咲函` 隗・ｽ懷ｾ・眺謾ｾ・形1` 荳咲ｮ暦ｼ帶沖謠城∞ `蜀咲函荳ｭ` 蛛懈ｭ｢・碁∞ `譛ｪ蜀咲函` 蜊ｴ莠､謐｢譛霑醍噪霎・ｰ・reqorder・瑚ｷｳ霑・憾諤∵沖謠丈ｸ主ｮ樣刔莠､謐｢荳肴弍蜷御ｸ莉ｶ莠九ゆｿ晄戟逵溷ｮ槫ｮ樒鴫・梧悴謾ｹ蜀呎・逅・Φ蛹問懃ｧｻ閾ｳ荳倶ｸ鬥問昴ょｼょｸｸ謨ｰ謐ｮ闍･蟇ｼ閾ｴ驥榊､埼弌蛻礼憾諤・ｼ君ode 霑泌屓 409 QUEUE_ORDER_CYCLE 蟷ｶ蝗樊ｻ夲ｼ梧崛莉｣ Legacy 蜿ｯ閭ｽ譌遨ｷ蠕ｪ邇ｯ・幄ｿ呎弍譏守｡ｮ螳牙・蟾ｮ蠑ゅる撼豕・HTTP ID/action 霑泌屓 400・御ｸ榊ｭ伜惠霑泌屓 404・御ｸ埼夂衍縲・

騾夂衍蜴滓悽菴堺ｺ朱弌蛻玲署莠､荵句錘縲∽ｸ疲立 helper 蜷槫､ｱ雍･・御ｸ､荳ｪ SQLite 譁・ｻｶ荵矩龍豐｡譛牙次蟄蝉ｺ句苅縲ら鴫蝨ｨ謌仙粥謠蝉ｺ､蜷惹ｻ・夂衍荳谺｡・碁夂衍荳榊庄逕ｨ霑泌屓 502 `QUEUE_COMMITTED_NOTICE_FAILED`・梧・遑ｮ窶憺弌蛻怜ｷｲ謠蝉ｺ､・御ｸ崎ｦ・㍾隸補晢ｼ帑ｸ崎・螢ｰ遘ｰ騾夂衍螟ｱ雍･莨壼屓貊壼ｷｲ謠蝉ｺ､髦溷・縲る弌蛻嶺ｺ句苅螟ｱ雍･荳埼夂衍縲４SE縲∝・隶｡謨ｰ隸ｭ荵峨∝紙蜿ｲ荳取眺謾ｾ蝎ｨ迥ｶ諤∽ｿ晄戟・帶ｲ｡譛牙ｮ樒鴫霍ｨ蠎・outbox 謌門ｹらｭ画惻蛻ｶ縲・

### Legacy 謾ｶ謨帛所菫晉蕗閭ｽ蜉・

蝨ｨ Compose 逧・YUKARI_NODE_QUEUE_MUTATIONS=1 荳具ｼ御ｻ･荳句・蜿｣蝨ｨ bootstrap/謨ｰ謐ｮ蠎楢ｮｿ髣ｮ蜑崎ｿ泌屓 **410**・悟ｼ募ｯｼ迢ｬ遶・admin-web 逋ｻ蠖包ｼ御ｸ肴滑 Basic 謌・read ticket 譏蟆・芦蜀吩ｼ夊ｯ晢ｼ・

- delete.php・亥桁蜷ｫ譌ｧ迥ｶ諤・㍾鄂ｮ・峨∥pi/request_delete.php縲∥pi/request_move.php縲・
- api/admin.php 逧・delete/move・妝ridge 譌ｧ admin-delete/admin-move 荵溷芦隸･蜈ｳ髣ｭ譽譟･縲・
- requestlist_reorder.php 謇ｹ驥乗許諡ｽ/Undo縲〕istclear.php縲〕istimport.php・蛍pdate.php 逧・reqorder 蜿よ焚縲・
- backup_restore.php 蜍ｾ騾画焚謐ｮ蠎鍋噪 restore・姨TTP fortest/test_race 逶ｮ蠖慕ｦ∵ｭ｢隶ｿ髣ｮ縲・

謇ｹ驥乗許諡ｽ縲∵ｸ・ｩｺ縲∝ｯｼ蜈･縲∫憾諤・㍾鄂ｮ荳取焚謐ｮ蠎捺△螟肴悽髦ｶ谿ｵ**譛ｪ霑∫ｧｻ荳比ｸ榊庄騾夊ｿ・立蜈･蜿｣謇ｧ陦・*・帛・髣ｭ譏ｯ荳ｺ髦ｻ豁｢螳・ｻｬ扈戊ｿ・眠蜊穂ｸ邂｡逅・・ Owner・御ｸ堺ｼｪ遘ｰ菫晄戟蜈ｨ驛ｨ譌ｧ蜀吝粥閭ｽ縲よ立 swipe 蟇ｹ 410 譏守｡ｮ謠千､ｺ縲∝屓隸ｻ・御ｸ肴滑螟ｱ雍･蠖捺・蜉滂ｼ帶立陦ｨ譬ｼ謖蛾聴諱｢螟榊庄逕ｨ迥ｶ諤∝ｹｶ扈咏ｮ｡逅・ｫｯ蝨ｰ蝮縲よ立髦溷・隸ｻ蜿悶∵勸騾壼・蟒ｺ縲∝ｭ玲ｮｵ郛冶ｾ大柱謦ｭ謾ｾ譬・ｮｰ蜈･蜿｣莉堺ｿ晉蕗縲ょ黒迢ｬ Legacy 驛ｨ鄂ｲ譛ｪ蠑蜷ｯ譬・ｿ玲慮莉堺ｿ晉蕗蜴溷ｮ樒鴫・悟ｱ樔ｺ惹ｸ榊酔驛ｨ鄂ｲ讓｡蠑上・

### SQLite 驛ｨ鄂ｲ霎ｹ逡・

Node 蜿ｪ蠅槫刈荳鍋畑 runtime/queue 逶ｮ蠖戊ｯｻ蜀呎揀髯撰ｼ梧ｲ｡譛画紛 Legacy 謖りｽｽ縲・夂衍蠎捺撃霓ｽ縲・・鄂ｮ蜀呎揀髯先・ Schema 蜿俶峩縲る撼 root Node 蜉蜈･ gid 33・娜HP 蜷ｯ蜉ｨ菴ｿ逕ｨ umask 0002縲∽ｸ鍋畑逶ｮ蠖・setgid/扈・・譚・剞・轡B/WAL/SHM 荳襍ｷ蜈ｱ莠ｫ・帑ｸ堺ｻ･蜈ｨ螳ｹ蝎ｨ root 隗｣蜀ｳ譚・剞縲よ園譛芽ｯｷ豎る夊ｿ・庄菫｡荳贋ｸ区枚蠕怜芦謨ｰ謐ｮ蠎鍋嶌蟇ｹ蜷搾ｼ罫ealpath 髯仙宛蛻ｰ驟咲ｽｮ逧・ｻ晏ｯｹ逶ｮ蠖包ｼ幄ｷｯ蠕・ｸ榊ｭ伜惠荳堺ｼ壻ｸｻ蜉ｨ蛻晏ｧ句喧謨ｰ謐ｮ蠎薙・

Node 豈乗ｬ｡莠句苅蜈ｳ髣ｭ霑樊磁・御ｻ堺ｿ晉蕗 queue-wal-anchor縲よ悽髦ｶ谿ｵ RW 逶ｮ蠖募庄閭ｽ蟾ｲ扈乗ｻ｡雜ｳ SQLite 蛻帛ｻｺ WAL/SHM 逧・揀髯先擅莉ｶ・御ｽ・ｲ｡譛牙唖髯､ anchor 譚･螳｣遘ｰ蠖ｻ蠎墓噺謨帷函蜻ｽ蜻ｨ譛溘ゆｸ倶ｸ髦ｶ谿ｵ蜿ｯ蜈亥惠蛛・anchor 逧・囈遖ｻ邇ｯ蠅・ｪ瑚ｯ∝宵隸ｻ霑樊磁縲∵浴譁・ｻｶ貂・炊/驥榊ｻｺ縲￣HP/Node 驥榊星荳・readiness・悟・蜀ｳ螳壼叙豸茨ｼ帑ｻ・滑邂｡逅・ｺ句苅霑∝芦 Node 荳咲ｭ我ｺ・Node 謖∽ｹ・凶譛牙・驛ｨ蜀吝・謌冶ｿ樊磁逕溷多蜻ｨ譛溘ら鴫蝨ｺ譛ｪ貂・差縲・㍾蟒ｺ蠎捺・譖ｴ謾ｹ驟咲ｽｮ/蟇・√・

### Phase 7 isolated test runbook

蜀呎ｵ玖ｯ穂ｽｿ逕ｨ `.local/phase7-test-legacy` 逧・粋謌宣・鄂ｮ蜥檎罰蜴・PHP 蛻帛ｻｺ逧・囈遖ｻ蠎難ｼ御ｸ榊､榊宛逕滉ｺｧ DB/INI/蟇・徴縲よｵ玖ｯ募・謐ｮ譏ｯ蜈ｬ蠑縲∽ｻ・畑莠取ｭ､ fixture 逧・ｭ礼ｬｦ荳ｲ・御ｸ肴弍邇ｰ蝨ｺ蟇・√ょ㊥螟・・譛ｬ莉・ｦ・尠蟶ｦ蝗ｺ螳壼粋謌・marker 逧・ｵ玖ｯ慕岼蠖輔ゆｸ､荳ｪ Compose 譁・ｻｶ菴ｿ逕ｨ蜷御ｸ鬘ｹ逶ｮ荳取悽譛ｺ遶ｯ蜿｣・御ｸ崎・蜷梧慮霑占｡鯉ｼ帶ｵ玖ｯ慕ｻ捺據諱｢螟肴ｭ｣蟶ｸ驟咲ｽｮ・梧裏髴蛻髯､莉ｻ菴・volume縲・

```powershell
node docker/prepare-isolated-tests.mjs
docker compose -f docker/compose.yaml stop api-server web
docker compose -f docker/compose.isolated.yaml up --build -d
$env:E2E_COMPOSE_FILE='docker/compose.isolated.yaml'
$env:E2E_CONFIG_PATH=(Join-Path (Get-Location) '.local/phase7-test-legacy/config.ini')
npm.cmd --prefix apps/api-server test
npm.cmd --prefix apps/user-web run test:e2e
npm.cmd --prefix apps/admin-web run test:e2e
# Also run each app's typecheck/build and existing PHP lint/auth commands.
docker compose -f docker/compose.isolated.yaml stop api-server web
docker compose -f docker/compose.yaml up --build -d
Remove-Item Env:E2E_COMPOSE_FILE, Env:E2E_CONFIG_PATH
```

豬玖ｯ戊ｾ・勧螳｢謌ｷ遶ｯ蟇ｹ鬚・沺蜀呎桃菴懆ｦ∵ｱる囈遖ｻ marker・娜laywright 蝨ｨ蜷ｯ蜉ｨ蜑堺ｹ滓｣譟･縲りｷｨ霑占｡梧慮髞∵ｵ玖ｯ募ｰ・ｸ､遶ｯ蝮・叛 Linux 螳ｹ蝎ｨ・碁∩蜈・Windows/Linux 蟇ｹ WAL shared-memory/髞∵ｼ蠑冗噪蟾ｮ蠑ゑｼ幃夊ｿ・升謇玖ｮｩ PHP 謖・煤閾ｳ Node 蠑蟋狗ｫ樔ｺ会ｼ悟・蟒ｶ霑滓署莠､・碁ｪ瑚ｯ∫ｭ牙ｾ・柱譁ｰ蠢ｫ辣ｧ扈捺棡縲１HP oracle 逶ｴ謗･謇ｧ陦悟次 function_requestops.php 荳取歓蜿也噪蜴・normalize 蜃ｽ謨ｰ・御ｽｿ逕ｨ蜀・ｭ伜ｺ灘ｯｹ辣ｧ螳梧紛髦溷・蟄玲ｮｵ荳主紙蜿ｲ・帑ｸ肴弍謇句・ PHP 蜿り・ｻ霎代よｵ玖ｯ・DB/runner/謌ｪ蝗ｾ蜿ｪ逡吝ｿｽ逡･逧・`.local`/test-results縲・

### Phase 7 逧・・蟒ｺ鬚・ｺｦ霑∫ｧｻ隸・ｼｰ・亥ｷｲ逕ｱ Phase 8 螳梧・・・

霑∫ｧｻ謌先悽譏取仞鬮倅ｺ守ｮ｡逅・唖/遘ｻ・夐怙隕∬ｿ∫ｧｻ霎灘・鮟倩ｮ､蛟ｼ縲∵勸騾・蟆丈ｼ第ｭ｢/譖ｿ謐｢蟾ｮ蠑ゅ∫畑謌ｷ霄ｫ莉ｽ縲∬・蜉ｨ霓ｮ謐｢縲∝・謨ｰ謐ｮ譟･隸｢縲”istory/Cookie縲・夂衍蜥碁漠隸ｯ螂醍ｺｦ縲ら鴫 exec.php 蝨ｨ INSERT/reqorder/閾ｪ蜉ｨ霓ｮ謐｢ COMMIT 蜷趣ｼ梧燕譟･ Lister 蜈・焚謐ｮ縲∬｡･蜀吶∵峩譁ｰ騾夂衍縲∬ｮｰ蠖募紙蜿ｲ・梧怙蜷手ｾ灘・ newid・帛錘扈ｭ蠑ょｸｸ莨壻ｺｧ逕溪懷ｷｲ蟄伜惠鬚・ｺｦ菴・桃蠎泌､ｱ雍･窶昴ゆｸ崎・莉･ Node 驥崎ｯ・PHP POST縲∫ｬｬ莠梧ｬ｡ INSERT 謌門､ｱ雍･蜊ｳ蝗樊ｻ壼燕遶ｯ譏ｾ遉ｺ隗｣蜀ｳ縲・

荳願ｿｰ髫皮ｦｻ謨・囿豕ｨ蜈･縲∽ｺ句苅霎ｹ逡悟柱霍ｨ隸ｷ豎よ戟荵・ｹらｭ芽ｮｾ隶｡蟾ｲ蝨ｨ荳区婿 Phase 8 螳梧・縲・ode 扈滉ｸ謖∵怏謇譛我ｸｻ蜀吩ｺ句苅蜷趣ｼ御ｹ滉ｻ埼怙譏守｡ｮ霑樊磁逕溷多蜻ｨ譛滂ｼ帛庄蜿匁ｶ・anchor 逧・ｾ晄紺蠎疲弍 WAL/readiness 蝗槫ｽ堤ｻ捺棡・瑚御ｸ肴弍 Native 霍ｯ逕ｱ隶｡謨ｰ縲・

## Phase 8・夐｢・ｺｦ蛻帛ｻｺ/譖ｿ謐｢ Owner 蛻・困

### 荳壼苅 Owner 蜥瑚ｰ・畑體ｾ

| 謫堺ｽ・| Owner | 隸ｴ譏・|
| --- | --- | --- |
| `/api/v1/requests` 蛻帛ｻｺ/譖ｿ謐｢ | **Node-native** | Node 蝨ｨ蜴・queue SQLite 謇ｧ陦悟黒莠句苅・娜HP 蜿ｪ謠蝉ｾ帛ｷｲ隶､隸∫噪霄ｫ莉ｽ/蜿ｪ隸ｻ蜈・焚謐ｮ荳贋ｸ区枚蜿頑署莠､蜷守噪騾夂衍 helper・御ｸ肴鴬陦・exec.php 蜀吩ｺ句苅縲・|
| Legacy `/exec.php` 蛻帛ｻｺ/譖ｿ謐｢ | Node-native・亥・螳ｹ霓ｬ蜿托ｼ・| `YUKARI_NODE_REQUESTS=1` 譌ｶ逕ｱ `_request_forward.php` 蟶ｦ蜴・Cookie/陦ｨ蜊戊ｯｭ荵芽ｿ帛・蜿鈴剞 Fastify 霍ｯ逕ｱ・帛・髣ｭ譬・ｿ礼噪迢ｬ遶区立驛ｨ鄂ｲ莉堺ｽｿ逕ｨ譌ｧ PHP 霍ｯ蠕・・|
| 閾ｪ蜉ｨ菴咲ｽｮ縲∵崛謐｢縲∝紙蜿ｲ縲・｢・ｺｦ霄ｫ莉ｽ蟄玲ｮｵ | Node-native | `requesttable` 蜿俶峩縲∝ｿ・ｦ∝・謨ｰ謐ｮ蜥・history 荳取戟荵・ｹらｭ牙・謐ｮ蝨ｨ `BEGIN IMMEDIATE` 荳ｭ蜈ｱ蜷梧署莠､縲・|
| 騾夂衍/SSE | PHP 騾夂衍 helper | 莉・惠 Node commit 蜷手ｰ・畑・帛､ｱ雍･貂・･壽・ｮｰ蟾ｲ謠蝉ｺ､・御ｸ埼㍾隸暮｢・ｺｦ莠句苅縲・|
| 謳懃ｴ｢縲〆ukaLister/Everything縲∵眺謾ｾ荳主・謨ｰ謐ｮ逕溷多蜻ｨ譛・| PHP | 謳懃ｴ｢邂玲ｳ墓悴霑∫ｧｻ・娟ode 鬚・ｺｦ蜿ｯ蝨ｨ謠蝉ｺ､蜑崎ｯｷ豎ょ宵隸ｻ譖ｲ蠎灘・謨ｰ謐ｮ縲・|
| 邂｡逅・唖髯､縲∝黒鬘ｹ隹・ｺ・蠖剃ｸ蛹・| Node-native | Phase 7 蟾ｲ霑∫ｧｻ縲・|
| Legacy 謇ｹ驥乗賜蠎・Undo | Node-native admin endpoint; Legacy uses an exact fixed-path ProxyPass | An exact fixed-path ProxyPass plus exact Location authorization now serves this route. Other `/api/v1` paths remain denied; Authorization is stripped and the Node admin cookie/session plus CSRF/Origin checks remain mandatory. |

### 蜿よ焚縲・Κ蛻・・蜉溷柱蟷らｭ・

Node 隸ｷ豎ゆｿ晉蕗譎ｮ騾・蟆丈ｼ第ｭ｢縲《inger/freesinger縲…omment縲《ecret縲〉eplace/selectid縲「rlreq縲〔ind縲∬・蜉ｨ reqorder 荳取立 Cookie 霄ｫ莉ｽ隸ｭ荵峨よ崛謐｢豐ｿ逕ｨ逶ｮ譬・ｮｰ蠖慕噪髦溷・菴咲ｽｮ/謦ｭ謾ｾ迥ｶ諤・霄ｫ莉ｽ蟄玲ｮｵ・碁∩蜈肴滑譖ｿ謐｢謾ｹ謌先眠蟒ｺ・帛ｿ・ｦ∝・謨ｰ謐ｮ蜥悟紙蜿ｲ蟾ｲ蝨ｨ蜷御ｸ髦溷・莠句苅蜀・､・炊縲・egacy PHP 逧・ｮ樣刔 exec.php 蜃ｽ謨ｰ蝨ｨ髫皮ｦｻ謨ｰ謐ｮ蠎謎ｽ應ｸｺ oracle・帶ｭ｣蟶ｸ縲∵崛謐｢縲・ｻ倩ｮ､蛟ｼ縲∽ｿ晏ｯ・∝紙蜿ｲ縲∬ｺｫ莉ｽ縲∬・蜉ｨ菴咲ｽｮ蜥悟､ｱ雍･蝗樊ｻ壼插蟇ｹ辣ｧ縲・ode 蝨ｨ蜴・彰蜀吝､ｱ雍･譌ｶ謨ｴ菴灘屓貊夲ｼ訓HP oracle 隸∵・譌ｧ螳樒鴫莨壼惠荳ｻ鬚・ｺｦ commit 蜷守蕗荳矩Κ蛻・・蜉滂ｼ瑚ｿ呎弍譛ｬ谺｡譏守｡ｮ菫ｮ螟咲噪蟾ｮ蠑ゅ・

蟷らｭ芽｡ｨ `request_submission` 蜿ｪ蝨ｨ蜴・queue SQLite 荳ｭ譁ｰ蠅橸ｼ御ｸ肴隼邇ｰ譛芽｡ｨ蛻暦ｼ帷畑謌ｷ蟾ｲ謇ｹ蜃・ｯ･ additive schema縲Ｎigration 譏ｯ CLI 譏ｾ蠑乗鴬陦後∝庄驥榊､埼ｪ瑚ｯ・ｼ御ｸ榊惠 Node 蜷ｯ蜉ｨ譌ｶ閾ｪ蜉ｨ謇ｧ陦後よ恪蜉｡蝎ｨ蜿大・髫乗惻謠蝉ｺ､ receipt・御ｻ・ｿ晏ｭ伜嶋蟶後∬ｧ・激蛹冶ｾ灘・蜩亥ｸ後∫畑謌ｷ owner縲・｢・ｺｦ ID縲∵桃菴懊∵慮髣ｴ蜥梧怏髯千ｻ捺棡縲ら嶌蜷・receipt/霎灘・蝗樊叛蜷御ｸ扈捺棡・幄ｾ灘・荳榊酔霑泌屓蜀ｲ遯・ｼ悟・莉・owner 譟･荳榊芦扈捺棡縲ょ燕遶ｯ螟ｱ雍･蜷主､咲畑逶ｸ蜷・receipt 譟･隸｢/蝗樊叛・御ｸ榊ｾ礼函謌先眠逧・署莠､髞ｮ驥崎ｯ穂ｸ咲｡ｮ螳壽桃菴懊る夂衍螟ｱ雍･荳埼㍾蜀咎｢・ｺｦ・幄ｷｨ蠎馴夂衍 exactly-once 譛ｪ螳樒鴫縲・

### 譌ｧ蜈･蜿｣譚・剞荳守ｮ｡逅・粥閭ｽ

譁ｰ user-web 菴ｿ逕ｨ user session縲，SRF 蜥・`/api/v1/requests`・姚egacy 鬘ｵ髱｢蜈亥叙 request intent・君ode 謇譛画揀蜷ｯ逕ｨ譌ｶ闔ｷ蜿紋ｸ谺｡諤ｧ遲ｾ蜷崎ｽｬ蜿大・謐ｮ・悟次 exec.php 蜿ｪ蛛壼・螳ｹ霓ｬ莠､縲・ridge 鬪瑚ｯ∝次 Cookie 霄ｫ莉ｽ・帶ｵ剰ｧ亥勣隗定牡螟ｴ荳榊盾荳手ｮ､隸√・astify 扈ｧ扈ｭ鬪瑚ｯ∫畑謌ｷ session縲＾rigin 蜥悟・隸ｷ豎よ・ｮｰ縲よｲ｡譛・Node竊単HP竊誰ode 鬚・ｺｦ蜀吝ｾｪ邇ｯ・沓ridge 逧・宵隸ｻ霄ｫ莉ｽ/蜈・焚謐ｮ蜿企夂衍隹・畑荳肴弍鬚・ｺｦ蜀吝・縲・

Phase 7 逧・ｸｸ逕ｨ譌ｧ迚域音驥乗賜蠎・Undo 蟾ｲ蛻・・ admin-only `/api/v1/admin/queue/reorder`縲ょ・蟋・regex ProxyPass 豬剰ｧ亥勣蝗槫ｽ定ｿ泌屓 403・帶隼荳ｺ exact-path ProxyPass 蜥・exact Location authorization 蜷・Legacy Edge 蝗槫ｽ帝夊ｿ・ょ・莉・`/api/v1` 霍ｯ蠕・ｻｧ扈ｭ諡堤ｻ晢ｼ梧ｵ剰ｧ亥勣 Basic 陲ｫ蜑･遖ｻ・君ode 邂｡逅・Cookie/莨夊ｯ昴＾rigin 蜥・CSRF 譽譟･荳榊序縲よｸ・ｩｺ縲∝ｯｼ蜈･縲∵△螟阪∵立 delete 迥ｶ諤・㍾鄂ｮ莉榊・髣ｭ縲・

### 鬪瑚ｯ∽ｸ主ｽ灘燕驛ｨ鄂ｲ

髫皮ｦｻ逵溷ｮ・API suite 26/26 騾夊ｿ・ｼ娜HP oracle 蝨ｨ豈乗ｬ｡霑占｡悟・蟒ｺ迢ｬ遶・SQLite 蟷ｶ謇ｧ陦悟次 exec.php 荳壼苅菴難ｼ娟ode/PHP 陦御ｸｺ蟾ｮ蠑ょ柱荳ｻ莠句苅謨・囿蝗樊ｻ壼ｷｲ鬪瑚ｯ√・PI縲「ser-web縲∥dmin-web typecheck/build 蝮・夊ｿ・・egacy 逕ｨ謌ｷ鬚・ｺｦ豬剰ｧ亥勣體ｾ騾夊ｿ・ｼ孛ser-web/Legacy Edge 5/5 騾夊ｿ・ｼ檎悄螳樊ｭ梧峇謳懃ｴ｢謖・fixture 譛ｪ驟咲ｽｮ霍ｳ霑・ｼ嫗dmin-web Edge 3/3 騾夊ｿ・ｼ井ｸ､荳ｪ Vite 譛榊苅蟷ｶ陦鯉ｼ峨・

逵溷ｮ樊焚謐ｮ蠎灘宵謇ｧ陦檎ｻ乗音蜃・噪 additive `request_submission` 陦ｨ霑∫ｧｻ・幄ｿ∫ｧｻ蜑榊錘 queue 隶ｰ蠖墓遭隕・怙荳閾ｴ縲よｲ｡譛牙ｯｹ逵溷ｮ樣｢・ｺｦ霑幄｡悟・豬玖ｯ輔りｷｨ SQLite 騾夂衍諱ｰ螂ｽ荳谺｡縲∵峇蠎灘多荳ｭ蜥梧眺謾ｾ蝎ｨ謇ｧ陦悟ｰ壽悴鬪瑚ｯ・ｼ姚egacy reorder exact-path Apache 譏蟆・ｷｲ騾夊ｿ・Edge縲Ｒueue-wal-anchor 證ら蕗・壽悽髦ｶ谿ｵ豐｡譛牙ｮ梧・蜈ｶ蛛懈惻荳取浴譁・ｻｶ逕溷多蜻ｨ譛滓ｵ玖ｯ包ｼ御ｸ崎・蝗 Node 鬚・ｺｦ蛹也峩謗･蛻髯､縲・

## Phase 9・啗indows Player Agent・亥ｮ樊眺鬪梧噺騾夊ｿ・ｼ・

### 謦ｭ謾ｾ荳壼苅螳｡隶｡荳・Owner

| 蜉溯・ | 蠖灘燕 Owner | Phase 9 迥ｶ諤・|
| --- | --- | --- |
| 蜴滄｢・ｺｦ迥ｶ諤√］owplaying 譬・ｮｰ縲∵眺謾ｾ霑帛ｺｦ/髻ｳ驥丞￥遘ｻ縲］ext/start/stop | Legacy PHP + MPC-BE/foobar | 菫晉蕗蜴溷・蜿｣蜥瑚ｯｭ荵会ｼ梧悴霓ｬ謗･譁ｰ Agent |
| 謦ｭ謾ｾ莉ｻ蜉｡縲∽ｻｻ蜉｡ ID/迥ｶ諤√、gent 蠢・ｷｳ縲∫ｮ｡逅・遭莉ｻ蜉｡/謗ｧ蛻ｶ蜻ｽ莉､ | Fastify + 蜊慕峡 Player Agent JSON 迥ｶ諤∝差 | Node 譁ｰ蠅橸ｼ帛宵謾ｯ謖∫ｮ｡逅・遭蜿題ｵｷ譛ｬ蝨ｰ豬玖ｯ戊ｧ・｢托ｼ御ｸ崎ｯｻ蜀・requesttable |
| 螳樣刔隗｣遐・證ょ●/扈ｧ扈ｭ/EOF 蜿埼ｦ・| Windows mpv 騾夊ｿ・悽譛ｺ JSON IPC | 2026-10-20 莉･ 15 遘呈悽蝨ｰ蜷域・隗・｢大ｮ樣刔鬪梧噺・妁PI 竊・Fastify 竊・Agent 竊・mpv 蟾ｲ謦ｭ謾ｾ縲∵嘯蛛懊∵△螟阪∝●豁｢・悟ｹｶ蝨ｨ隨ｬ莠梧ｬ｡螳梧紛謦ｭ謾ｾ謾ｶ蛻ｰ EOF |
| 逕ｨ謌ｷ蜈ｬ蠑 Agent 迥ｶ諤・| Fastify | 蜿ｪ證ｴ髴ｲ connected/playback/active・御ｸ肴垓髴ｲ譁・ｻｶ蜷阪∫ｻ晏ｯｹ霍ｯ蠕・・ task ID |
| PotPlayer 謗ｧ蛻ｶ | 譌譁ｰ Owner | 譛ｬ譛ｺ迚域悽 26.06.22.0 逧・CmdLine64.txt 遑ｮ隶､蜻ｽ莉､陦悟庄謖・ｮ・content縲・current縲・new 蜥・playlist・帶悴蜿醍鴫謾ｯ謖∫噪謦ｭ謾ｾ迥ｶ諤・扈捺據莠倶ｻｶ謌門庄髱譌辟ｦ轤ｹ pause API・梧腐荳堺ｼｪ遘ｰ謾ｯ謖・|

譁ｰ蠅樊磁蜿｣・啀OST /api/v1/admin/player-agent/test・育ｮ｡逅・遭莨夊ｯ昴＾rigin/CSRF・帛宵蛻帛ｻｺ驟咲ｽｮ螂ｽ逧・ｵ玖ｯ戊ｧ・｢台ｻｻ蜉｡・峨；ET /api/v1/admin/player-agent縲￣OST /api/v1/admin/player-agent/control・・ause/resume/stop・会ｼ妁gent 莉･迢ｬ遶・Bearer token 隹・畑 POST /api/v1/agent/next 荳・/report縲よ勸騾夂畑謌ｷ GET /api/v1/playback/agent 莉埼怙譎ｮ騾壻ｼ夊ｯ晢ｼ悟宵霑泌屓閼ｱ謨冗憾諤√・gent 霍ｯ逕ｱ荳堺ｿ｡莉ｻ莉ｻ菴戊ｧ定牡/IP Header・帛・ Bearer 荳肴弍豬剰ｧ亥勣莨夊ｯ昴らｮ｡逅・API 荳肴磁蜿玲ｵ剰ｧ亥勣莨蜈･霍ｯ蠕・∝多莉､謌・exe縲・

莉ｻ蜉｡迥ｶ諤・pending 竊・claimed 竊・playing 竊・completed|failed・荊ask ID 蜚ｯ荳・帛酔荳豢ｻ蜉ｨ莉ｻ蜉｡蜿ｪ蛻・ｻ吩ｸ荳ｪ Agent ID・檎ｻ域∽ｸ榊庄蝗樣縲ら憾諤∝ｿｫ辣ｧ騾夊ｿ・次蟄・JSON 譖ｿ謐｢菫晏ｭ伜惠迢ｬ遶・player_agent_state Docker volume・御ｸ肴隼邇ｰ譛・SQLite Schema・御ｸ堺ｸ・queue-wal-anchor 蜈ｱ莠ｫ逕溷多蜻ｨ譛溘Ｑause/resume 譏ｯ Agent 謗ｧ蛻ｶ謖・ｻ､・御ｸ肴滑 task 迥ｶ諤∵隼謌絶懷ｮ梧・窶昴ょ●豁｢荳ｺ stopped/failed 扈捺棡・嬶pv EOF end-file 荳・reason=eof 謇肴・ｮｰ completed縲ゆｻｻ蜉｡/API 迥ｶ諤∵ｻ槫錘謌・IPC 譁ｭ郤ｿ譌ｶ荳崎・莉手ｿ帷ｨ句・蟒ｺ謗ｨ譁ｭ螳樊眺・妁gent 騾夊ｿ・酔 task ID 驥崎ｿ橸ｼ悟ｹｶ蝨ｨ API 荳｢螟ｱ豢ｻ蜉ｨ莉ｻ蜉｡譌ｶ蛛懈ｭ｢謦ｭ謾ｾ蝎ｨ縲・SON 迥ｶ諤∝差髱｢蜷大ｽ灘燕蜊穂ｸｪ Fastify 螳樔ｾ具ｼ幃Κ鄂ｲ螟壻ｸｪ API 螳樔ｾ句燕髴謾ｹ荳ｺ荳閾ｴ諤ｧ莉ｻ蜉｡蜊剰ｰ・・

Agent 逧・PLAYER_MEDIA_ROOT 蠢・｡ｻ譏ｯ扈晏ｯｹ逶ｮ蠖包ｼ娜LAYER_TEST_VIDEO 蜿ｪ閭ｽ譏ｯ隸･逶ｮ蠖穂ｸ狗噪逶ｸ蟇ｹ譁・ｻｶ蜷阪ょ曙譁ｹ realpath 髯仙宛霍ｯ蠕・ｼ梧拠扈晉岼蠖慕ｩｿ雜雁柱譬ｹ逶ｮ蠖募､・symlink縲ゆｻ・崋螳・MPV_PATH 蜿ｯ菴應ｸｺ謇ｧ陦梧枚莉ｶ・茎pawn 菴ｿ逕ｨ argv 荳・shell:false縲Ｎpv 蜻ｽ蜷咲ｮ｡驕謎ｻ・惠螳ｿ荳ｻ譛ｺ譛ｬ蝨ｰ菴ｿ逕ｨ・御ｸ肴丐蟆・芦 Docker 鄂醍ｻ懊ょｿｽ逡･逧・.local/player-agent-token 譏ｯ髫乗惻蜃ｭ謐ｮ・靴ompose API 蜿ｪ隸ｻ謖りｽｽ・妁gent token 隶､隸∽ｸ主次 Bridge/admin/session 蜃ｭ謐ｮ蛻・ｼ縲・gent 豈乗ｬ｡ heartbeat/next 驛ｽ謚･蜻・`testReady`・帶恪蜉｡遶ｯ蜿顔ｮ｡逅・UI 蝨ｨ郛ｺ蟆醍悄螳樣・鄂ｮ隗・｢第慮諡堤ｻ晏・蟒ｺ豬玖ｯ穂ｻｻ蜉｡縲・

### PotPlayer / mpv 譬ｸ螳樔ｸ主ｮ樊眺霎ｹ逡・

螳ｿ荳ｻ譛ｺ蟾ｲ螳芽｣・PotPlayer 64-bit・檎沿譛ｬ 26.06.22.0・悟ｮ芽｣・岼蠖穂ｸｭ逧・CmdLine64.txt・・/19 譖ｴ譁ｰ・画・遑ｮ譛画枚莉ｶ content 蜿よ焚縲・new縲・current縲・add縲・insert縲・seek縲ょ屏豁､螟夜Κ蜷ｯ蜉ｨ蟷ｶ謇灘ｼ譁・ｻｶ蟾ｲ逕ｱ蜿題｡悟桁譁・｡｣遑ｮ隶､縲よｲ｡譛牙書邇ｰ隸･迚域悽謾ｯ謖・HTTP API 謌匁衍隸｢迥ｶ諤・蜿ｯ髱 EOF 豸域・・帶立 MPC-BE HTTP 遶ｯ蜿｣荳・PotPlayer 荳咲ｭ我ｻｷ縲よ嘯蛛・蛛懈ｭ｢蜿ｯ逕ｱ謦ｭ謾ｾ蝎ｨ UI 莠ｺ蟾･謫堺ｽ懶ｼ御ｽ・悴謗･蜈･閼・ｼｱ髞ｮ逶・遯怜哨豸域・縲・

mpv 螳俶婿謇句・遑ｮ隶､ Windows 逧・input-ipc-server 菴ｿ逕ｨ named pipe・繰SON IPC 譛牙多莉､蜩榊ｺ斐∝ｱ樊ｧ荳惹ｺ倶ｻｶ・姜PC 譛ｬ霄ｫ荳榊ｮ牙・・悟屏豁､蜿ｪ菫晉蕗蝨ｨ螳ｿ荳ｻ譛ｬ譛ｺ・熊astify 蜃ｭ謐ｮ逕ｨ莠守ｽ醍ｻ・Agent 霎ｹ逡後・gent 蜈郁ｿ槫崋螳壼ｮｿ荳ｻ pipe・悟・謖牙崋螳夐・鄂ｮ蜷ｯ蜉ｨ mpv・帛ｮ槫・譚･閾ｪ idle-active / pause / path 螻樊ｧ・檎ｻ捺據蜿ｪ隶､ end-file reason eof縲りｧ・[mpv 螳俶婿 JSON IPC 謇句・](https://mpv.io/manual/stable/#json-ipc)縲・

譛ｬ譛ｺ蟾ｲ遑ｮ隶､ winget 蛹・`shinchiro.mpv 0.41.0` 逧・庄謇ｧ陦梧枚莉ｶ `C:\Program Files\MPV Player\mpv.exe` 蜿ｯ逶ｴ謗･霑占｡・`--version`・瑚ｾ灘・迚域悽 `v0.41.0-244-gaf9c81fa1`・妁gent 扈乗仞蠑・`MPV_PATH` 菴ｿ逕ｨ隸･譁・ｻｶ・御ｸ堺ｾ晁ｵ・PATH縲・Fmpeg 9.0 逕滓・莉灘ｺ灘､・`D:\project\yukari\test-media\agent-test.mp4`・・5 遘抵ｼ粂.264 640ﾃ・60 隗・｢台ｸ・AAC 48kHz 髻ｳ霓ｨ縲ょｮ樣刔 Fastify 邂｡逅・ｼ夊ｯ晏・蟒ｺ荳､鬘ｹ豬玖ｯ穂ｻｻ蜉｡・夂ｬｬ荳鬘ｹ逕ｱ Node API 荳・Agent 遑ｮ隶､ playing 竊・pause 竊・resume 竊・stop・悟●豁｢蜷取ｲ｡譛蛾㍾蠑・帷ｬｬ莠碁｡ｹ蜿ｪ譛画噺蛻ｰ mpv JSON IPC `end-file reason=eof` 蜷・Fastify 謇堺ｿ晏ｭ倅ｸｺ completed縲よ眺謾ｾ隶ｰ蠖穂ｻ・惠 `player_agent_state` 豬玖ｯ穂ｻｻ蜉｡蜊ｷ・御ｸ崎ｧｦ遒ｰ requesttable縲Ｎpv 遨ｺ髣ｲ譌ｶ `path` 螻樊ｧ逧・`property unavailable` 蟾ｲ謖・idle 螟・炊・帷ｼｺ蟆大ｷｲ蜉霓ｽ霍ｯ蠕・ｻ堺ｸ崎・謚･蜻・playing縲らｮ｡逅・ｫｯ螳樣刔 UI 隗ｦ蜿醍噪譌ｩ譛滉ｻｻ蜉｡雜・慮譖ｾ螟ｱ雍･・御ｹ句錘逕ｨ隶､隸・Fastify API 螳梧・荳願ｿｰ髣ｭ邇ｯ・帛ｰ壼ｾ・畑謌ｷ遑ｮ隶､譯碁擇逕ｻ髱｢荳主｣ｰ髻ｳ縲１otPlayer 蜿ｪ鬪瑚ｯ∽ｺ・多莉､陦梧枚譯｣・梧悴螳樊眺・御ｸ皮憾諤・扈捺據莠倶ｻｶ閭ｽ蜉帑ｻ肴悴遑ｮ隶､縲・

Phase 9 acceptance update: real media playback, audio, visible video, pause/resume/stop and mpv EOF were verified on the Windows host. Phase 10 adds isolated queue playback; production autoplay remains disabled and does not yet replace karaoke-specific playback lifecycle integrations.


Phase 9 admin Vite routes: the dev proxy permits only exact /api/v1/admin/player-agent GET and /test/control POST paths. This is a routing filter only; every request still requires the normal Fastify admin session and write CSRF/Origin validation. The no-session smoke check returns 401 from Fastify.


## Phase 10・哢ode-native 閾ｪ蜉ｨ謦ｭ謾ｾ・井ｻ・囈遖ｻ鬪瑚ｯ・ｼ・

| Operation | Owner | Contract and effects | Status |
| --- | --- | --- | --- |
| Opt-in queue claim / task scheduling | Fastify + SQLite `playback_task` | Admin-only start/control; Agent Bearer polling; ordered by existing reqorder ASC, id ASC | Implemented in code and isolated SQLite tests; explicit additive migration still pending for the deployed DB; Compose default disabled |
| Media path / player operations | Windows Player Agent + mpv | Realpath must remain under configured media root; fixed mpv executable/argv, shell disabled | Real video, pause/resume/skip and real EOF tested |
| Queue playback projection | Fastify `PlaybackTaskRepository` | Existing states only: 譛ｪ蜀咲函 竊・蜀咲函髢句ｧ句ｾ・■ 竊・蜀咲函荳ｭ 竊・蜀咲函貂・ explicit skip/stop/failure 竊・蛛懈ｭ｢荳ｭ; playtimes increments only on observed playing | Node-native; task/event and projection share transactions on the existing queue DB |
| Formal playback history | Fastify SQLite `playback_event` | Append-only authenticated state/command events; no credentials or media paths; admin-only read API | Implemented in isolated tests; deployed DB migration pending |
| Queue notification | Legacy notification helper | Called after committed state transitions; no queue-selection SQL or PHP playback control | Reused post-commit |
| Search, reservation, admin delete/move, settings write | Existing owners | Unchanged | Node/PHP ownership as prior phases |

YUKARI_NODE_AUTOPLAY is 0 in normal Compose and must remain opt-in until deployment-specific isolation and owner handoff are complete. The runtime file runtime/queue/node-autoplay.owner fences guarded Legacy playback/status writers while Node owns consumption; admin Stop releases it only after a terminal/idle task. Do not assume the fence reaches a separate Windows Legacy installation: it must share the same queue runtime directory and that manager must honor the fence, or be stopped before Node autoplay is enabled. On unsupported queue entries Node stops without changing the row and keeps ownership fenced; an administrator must explicitly stop automation before handoff.

Supported scope is playmode 1, local kind=蜍慕判 files in supported video formats, with all existing loop/pause/track/key/audiodelay/volume options at their neutral value. Small-pause entries, URLs/live streams, audio requests, alternate player kinds, karaoke options, comments, capture and progress integrations are not migrated. No song is selected twice concurrently; SQLite BEGIN IMMEDIATE serializes claims, and actual mpv EOF is required before 蜀咲函貂・ A lost/failed Agent report never infers completion.

Isolated real sequence: first video was played, paused/resumed, then skipped by admin and projected to 蛛懈ｭ｢荳ｭ; the next two synthetic rows were opened by mpv and each projected to 蜀咲函貂・only after its real EOF. Each row's playtimes was one. Two trailing synthetic 蟆丈ｼ第ｭ｢ rows remained untouched and safely blocked further automation. The three rows were deleted by exact synthetic singer/kind/path after Admin Stop. No real user queue was consumed. Automated regression: API/PHP oracle 35/35, user Edge 8 passed/1 skipped, admin Edge 3/3, Player Agent 3/3, and all typechecks/builds passed.

Phase 10 stop-control follow-up: a separate isolated real-mpv queue task was stopped by the authenticated admin route while playing. Fastify waited for Agent stop feedback, projected 蛛懈ｭ｢荳ｭ, did not claim a successor, then released the Legacy owner fence. The synthetic request/history were precisely cleaned up; no deployed queue was used.

### Phase 10 durable task-store follow-up

Formal queue task state no longer uses the JSON volume. `player_agent_state` remains for Phase 9 test tasks and short-lived Agent status only; old JSON queue snapshots are ignored and not deleted. Formal task assignment, command acknowledgement, state events, and the corresponding `requesttable.nowplaying`/`playtimes` projection are written in one `BEGIN IMMEDIATE` transaction. Node retains 15-second leases, refreshed by Agent polls. A lease timeout or Fastify restart turns `claimed`/`playing` into `uncertain`; the task is not replayed or marked completed. The owner fence remains until the authenticated Agent confirms a stop. A duplicate EOF is idempotent and creates no second event.

New additive migration `apps/api-server/migrations/002-playback-task.sql` creates `playback_task` and `playback_event` plus partial/lookup indexes. Task rows retain request ID, state, Agent ID, lease, command sequence, observed playback state, timestamps and sanitized error codes; event rows retain task ID, unique event key, event type, Agent ID, timestamp and allowlisted JSON details. Neither table stores media paths or credentials. Admin-only read API: `GET /api/v1/admin/playback/history?limit=&offset=`. It returns task/event pages and remains unavailable until the explicit schema migration is installed.

The migration was executed only against temporary synthetic SQLite files. It has not been applied to the deployed `request.db`; production autoplay remains disabled. Before deployment, stop all queue writers and the WAL anchor, take and verify a consistent backup including SQLite sidecar state, run `node dist/migrate.js request.db playback-task` once, verify table/index definitions and existing request/submission row counts, then restart with autoplay still disabled for smoke checks. Enabling autoplay is a separate operational decision after media-root and Legacy-owner handoff checks. No JSON volume was removed or rewritten by this follow-up.

Follow-up validation on 2026-10-21: full API/PHP oracle suite 40 passed, 1 optional real-mpv test skipped there; the separate Windows real-mpv + temporary-SQLite test passed 1/1 after actual playing, pause/resume, and EOF. user-web Edge passed 8 runnable tests with 1 real-search fixture skip; admin-web Edge passed 3/3. All four applications typechecked and built. Browser tests now take `API_PROXY_TARGET` from the process environment and support `E2E_WEB_PORT` to avoid reusing a developer server. One initial browser run used the default API proxy and created three uniquely marked `ReactNodeE2E_` small-rest test reservations in the deployed queue. They were immediately deleted through the authenticated Node admin endpoint; the associated three test users/history and submission receipts were removed by exact owner/request IDs. Read-only verification found no matching rows or receipts and a contiguous remaining queue. The deployed schema was not migrated and autoplay remained off. After stopping the normal PHP/API containers, a consistent pre-migration copy of `request.db` plus present `-wal`/`-shm` sidecars was placed in the Git-ignored `.local/phase10-playback-backup/`; `integrity_check`, queue/receipt counts, and the main-file SHA256 matched. Take a fresh snapshot again immediately before any later migration. Reservation/cleanup notification side effects cannot be reversed.

## Phase 11: isolated automatic playback and explicit media path mapping

Legacy `init.php` defines mode 1 as automatic sequential playback, mode 2 as manual playback start, mode 3 as manual playlist registration, mode 4 as BGM/jukebox mode that selects least-played eligible entries and randomizes ties (with anti-repeat/play-count balancing), and mode 5 as full random selection from the list including already-played rows. Modes 4/5 also exclude the Legacy karaoke-delivery kind; mode 5's legacy random upper bound has an off-by-one defect. Node does not reproduce those semantics. Fastify start and the SQLite claim repository accept only mode 1, so the current saved mode is never rewritten to force activation. Modes 2窶・ remain unsupported pending a separate behavior/equivalence decision.

Queue `fullpath` is supplied by the Legacy search result and persisted unchanged; PHP search templates construct it from the result path plus filename. Docker Compose does not mount Windows media into the PHP or Node containers. The new Windows Agent accepts a POSIX absolute queue path only when it matches an explicitly configured `PLAYER_PATH_MAPPINGS` source. The corresponding target must already exist beneath `PLAYER_MEDIA_ROOT`; longest source-prefix matching, canonical POSIX checks, `realpath`, file checks, and root containment reject traversal, missing files, external symlinks, and unmapped roots. These mappings are host Agent configuration, not API/client input. Existing Windows absolute/relative paths remain accepted only when their resolved real path is under `PLAYER_MEDIA_ROOT`. The synthetic test used `/synthetic-media` mapped to a temporary Windows directory; it did not configure or infer a production library mapping. Production queue path formats have not been surfaced in this report; a real mapping must be prepared from the operator's reviewed storage layout before enabling formal playback.

The admin System page now displays the current Agent/task state and a sanitized task history (request ID, state, timestamps only); the history endpoint remains admin-session protected and never returns media paths. A Windows real-mpv test with a temporary SQLite database and two synthetic rows completed the first row, verified its actual EOF event and Legacy `蜀咲函貂・/`playtimes=1` projection, then automatically claimed and completed the second row on its own EOF. It also exercised pause/resume, admin start/stop, history response, one active task at a time, and mapped paths. During this test a defect was found: deterministic `playback_event.event_key` values were unique across the whole database, so fixed event types on later tasks could be silently ignored. Keys are now scoped by task ID; the two-task test verifies an EOF event for each. No real queue was read for writing or modified.

Validation: Player Agent path/IPC tests 4/4; focused playback-task/autoplay API tests 13/13; the real Windows mpv + isolated SQLite sequential playback E2E passed 1/1; API, admin-web, user-web and Player Agent typecheck/build passed. The full API suite was attempted but 15 integration/oracle cases could not run in this environment because Docker Engine access is denied and the isolated-write `E2E_CONFIG_PATH` is not configured; the suite reported 25 passed, 15 failed due those prerequisites, and 1 optional real-mpv test skipped. User/admin browser E2E were not run because no isolated Docker deployment could be started; production endpoints were not used for write tests. Compose service health endpoints returned HTTP 200, but Docker process inspection was denied. Formal autoplay remains disabled. Production media mapping, saved playmode 3 compatibility, Windows Legacy manager handoff/fence, and full Legacy karaoke side effects remain prerequisites before any production enablement.

## Phase 12: manual-start strategy, media preflight, and test environment

### Playback mode compatibility

The Legacy setting remains the source of truth and is only read by Fastify:

| Legacy setting | Legacy behavior | Node strategy available in admin System | Compatibility notes |
| --- | --- | --- | --- |
| `playmode=1` | Sequential automatic start/advance | Arm FIFO automatic playback | Same `reqorder ASC, id ASC` selection; actual mpv playing/EOF still gates projection. |
| `playmode=2` | Manual playback-start handshake for each request | Arm manual mode, then click **Start next request** per song | Fastify claims one FIFO row only after the explicit click; after EOF it waits for another click. This is a Node runtime policy, not a change to the Legacy INI. |
| `playmode=3` | Register/manage a manual player playlist | No Node control; admin page explains unsupported mode | Playlist insertion/order and user-driven player state are not equivalent to one-file mpv tasks. Feasibility only; not implemented. |
| `playmode=4` | Jukebox, least-played eligible songs, random ties, anti-repeat/balancing | Unsupported | Do not approximate with FIFO or mutate play counts to force eligibility. |
| `playmode=5` | Random selection regardless of prior play count; excludes karaoke-delivery kind | Unsupported | Legacy random selection has an upper-bound defect; neither algorithm is copied. |

Mode 2 is deliberately single-step: arming acquires the existing shared owner fence but does not claim a request. An admin start-next action is required before each task. Existing queue position/status markers remain the same; the Node claim, real playing, and real mpv EOF transaction rules are unchanged. Pause/resume/skip/stop remain admin-only. A mode mismatch or a Legacy active marker returns a conflict before Node takes ownership. Fastify does not save the `playmode` field.

`manage-mpc.php` refuses startup while `runtime/queue/node-autoplay.owner` exists and checks the same fence inside its long-running playback loops. Fastify also refuses initial handoff when `requesttable` contains a Legacy active playback marker. This guards both already-running manager loops and new launches. Windows process inspection during Phase 12 found no running PHP/MPC/foobar/mpv playback process; the containerized Legacy runtime was healthy. Before future production activation, also ensure no external scheduled task/launcher will repeatedly run the Windows manager. The normal Compose setting remains `YUKARI_NODE_AUTOPLAY=0`.

### Media preflight and paths

Admin System lists current queue rows and lets an authenticated administrator request a media check. The request contains a queue ID only. Fastify reads that row's stored `fullpath`, creates a short-lived check handoff in memory, and returns no path to the browser. The Agent receives the path only over its independent Bearer-authenticated poll, applies the configured `PLAYER_PATH_MAPPINGS`/`PLAYER_MEDIA_ROOT` realpath allowlist, and reports a sanitized state. Results distinguish `playable`, `path_unmapped`, `file_missing`, and `invalid_path`; a disconnected Agent is shown as `agent_offline`. Probe paths are not persisted, logged, or included in API responses. An expired or stale probe fails closed and can be requested again.

The mapping format is explicitly configured on the Windows host, for example:

```powershell
$env:PLAYER_MEDIA_ROOT = 'D:\KaraokeMedia'
$env:PLAYER_PATH_MAPPINGS = '[{"source":"/verified/posix/library","target":"D:\\KaraokeMedia"}]'
```

Both roots above are examples only. The production POSIX prefix and Windows directory have not been determined; operators must compare actual stored queue paths with their reviewed host storage layout. No production path is inferred or supplied by the browser. A successful preflight confirms an existing regular file under the configured root; it does not imply that currently unsupported request kinds/options or karaoke-specific controls (audio track, key, volume, delay, comments, progress capture, loops) have been migrated.

### Docker Compose test environment repair and Phase 12 validation

This Windows installation has Docker Engine 29.8.2 and standalone Docker Compose v5.6.0, but the Docker CLI did not load the Compose plugin from the inaccessible per-user configuration. A temporary Compose plugin copy under ignored `.local/empty-docker-config/cli-plugins/` restored `docker compose` without changing Docker Desktop configuration. The separately mounted synthetic fixture `.local/phase10-sqlite-437670ad-test-legacy` was run as project `phase12isolated` on API/PHP ports 3100/8180. No production database or volume was used for write tests.

Run the protected API suite only with the synthetic path marker and matching compose file/project variables. Browser runs also need `API_PROXY_TARGET`, `E2E_API_BASE`, `E2E_PHP_BASE`, and a free `E2E_WEB_PORT`. After tests, stop only the synthetic `web` and `api-server` services; do not remove volumes. The Phase 12 result was: API/PHP oracle 44 tests, 43 passed, 0 failed, 1 optional real-mpv skipped; user Edge 8 passed/1 real-search fixture skipped; admin Edge 3 passed; Player Agent tests 4 passed. Real mpv two-request FIFO EOF verification remains from Phase 11. Formal production autoplay was not enabled.

Final rerun on 2026-10-21: API/PHP oracle **43 passed, 0 failed, 1 optional real-mpv skipped**; the optional test was separately run with installed Windows mpv and the external 15-second clip against temporary SQLite and passed **1/1**, including actual two-row FIFO advancement on real EOF. Player Agent **4/4**, PHP syntax **305/305**, and all four typecheck/build jobs passed. User-web Edge assertions: **8 passed, 1 skipped** (no real search result fixture); admin-web Edge: **3/3 passed**. Playwright printed all passing assertions but its Windows teardown process stayed alive; it was manually interrupted after result output. No live database writes were run. Both normal and synthetic Compose services reported healthy, and normal Compose retains `YUKARI_NODE_AUTOPLAY=0`. The visible process list did not show mpv/PHP/Legacy manager; restricted permissions did not allow ruling out another user's elevated process or scheduled task.

## Phase 13: local operation and unified built UI

Production-built user-web and admin-web are built as Docker image stages and served by the existing Apache origin at `/user/` and `/admin/`; `/app/` is a small portal. The old PHP page URLs remain on the same DocumentRoot. Apache reverse-proxies `/api/v1/` to Fastify for same-origin browser requests; Apache strips Authorization and does not grant roles. Fastify continues to enforce sessions, Origin, CSRF markers, and per-operation authorization. Vite remains the separate UI development mode on 5173/5174.

The Windows 11 launch scripts are in `scripts/windows/`. The media configuration wizard uses explicit folder/file selection and stores path-only settings in `%LOCALAPPDATA%\YukariPlayerAgent\agent-config.json`; credentials remain outside that file. POSIX-to-Windows mapping is only created from an operator-entered, exact verified prefix and remains constrained by the Agent's configured real media root. No production media root or mapping is supplied by this repository. Compose autoplay remains disabled.

Playwright's Windows teardown is handled by `scripts/run-web-e2e.mjs`, which owns and stops the exact Vite child. `E2E_BASE_URL` lets the same tests target built Apache pages without starting Vite.

## Phase 14: React UI refresh (no business ownership change)

The Japanese mobile-first user UI calls the same `/api/v1` search, request, queue, and playback contracts. Search results intentionally omit the internal `fullpath`; the selected song still submits the server-returned path to the existing reservation API. Privacy is the existing `ReservationInput.secret` field and its visibility masking remains server-owned. Queue position, singer masking, current playback and request status are rendered from real API responses. The UI does not manufacture search results or infer personal history; the reservation confirmation identifies only the latest successful submission on that page.

The desktop-first admin live-control page consumes existing authenticated Fastify endpoints for player-agent status/control, autoplay strategy, queue reads, move/delete, media preflight, and the already-existing bulk reorder route `POST /api/v1/admin/queue/reorder` (`{ids:number[]}`). The Vite dev proxy adds only that exact protected route. Fastify authorization remains authoritative. Queue/order/strategy are server-owned; UI displays modes 3窶・ as unsupported TODO and never edits the configured Legacy playmode. Settings, playback history and system diagnostics remain secondary pages. The Legacy MPC-BE/foobar controls and local test-video task controls remain in diagnostics; no new route or PHP business code was introduced. Absolute media paths, Agent file paths and credentials remain hidden.

Phase 14 changes presentation only. PHP still owns Everything/YukaLister search, settings writes, legacy playback side effects and other unconverted operations; Node owns existing request/queue mutations and playback coordination under the prior matrices. No Node/PHP ownership boundary or database schema changed. Real Edge tests ran against the isolated synthetic Phase 13 fixture, with API/PHP ports 3201/8281 and Vite 5193/5194 because Windows refused the fixture's original 3100/8180 bindings. The production Compose ports and autoplay setting were not changed.
# Phase 15: React routes, shared presentation and Legacy coverage

The Legacy-to-React page/action inventory is maintained in [LEGACY_FEATURE_MATRIX.md](LEGACY_FEATURE_MATRIX.md). It distinguishes missing React UI from missing API support and identifies the current business owner; a React page is not evidence that a PHP-owned domain has migrated.

Production SPA routes are scoped to `/user/` and `/admin/`; Vite development uses each app's own route root. Apache fallback does not cover `/app/` or Legacy PHP URLs. Shared UI primitives, semantic CSS theme tokens and the pure Japanese/Chinese/English dictionaries live in `packages/web-foundation/`; React hooks are adapters. The default locale is Japanese. User data such as titles, singer names and comments stays in its original form. Phase 15 changes no API/business owner, database, playback mode or autoplay setting.


## Phase 16 ? MySQL ownership boundary

| Domain | Owner after cutover | Compatibility notes |
| --- | --- | --- |
| Reservation create/replace, idempotency, user request history | Fastify + MySQL | Legacy exec forwards through the authenticated request adapter; PHP INSERT is disabled in Compose mode. |
| Queue read, delete, move, reorder | Fastify + MySQL | Legacy queue display uses the Node adapter; migrated PHP write paths remain blocked. |
| Formal playback tasks/events and migrated settings | Fastify + MySQL | Playback stays disabled by default. Legacy settings UI/write is blocked. Initial settings require whitelist import before parity. |
| Search, Everything/YukaLister metadata, legacy authentication proof and notification | Legacy PHP/services | Retained on existing adapters; no songs/media table was added. |
| Node sessions; saved-song/favorite/pair/external-identity functions | In-memory session store / Legacy-only | Auxiliary MySQL tables do not imply these endpoints have migrated. Do not treat old SQLite-backed endpoints as MySQL-backed functionality. |
| Legacy-only profile/favorites/pairing/import/backup/player tools | Legacy-only or unavailable in MySQL mode | Do not use old SQLite as a second authoritative store. Migrate individually or keep disabled. |

The Phase 16 status and test limits are recorded in [PHASE16-MYSQL-CUTOVER.md](PHASE16-MYSQL-CUTOVER.md). SQLite files, sidecars and backups are retained, but are no longer the intended reservation/playback source when `MYSQL_HOST` is configured.

### Phase 16 follow-up: current SQLite inventory and Everything host routing

The project is **not yet SQLite-free**. Active SQLite access found in Legacy includes: the primary `request.db` bootstrap/compatibility connection in `kara_config.php`; YukaLister `List.sqlite3` (search index, intentionally separate); MyPage profile/history/later/favorites/keyword/pair/Google tables in `mypage_class.php`; not-found requests; CMS comments; Bing/Bingo state; search priority data; update-notice counters; search/Lister readers; and getID3 SQLite cache code. Some player and queue write paths are guarded in MySQL mode, but the shared Legacy bootstrap still opens and can schema-update its SQLite queue DB. These findings block removing the SQLite bind and WAL support until each active page is migrated or explicitly disabled and tested. `test_race` and `apps/api-server` SQLite repositories are test/non-MySQL fallback code, not the configured Compose MySQL path.

MySQL tables `saved_song`, `favorite_keyword`, `pair_code`, and `external_identity` exist but their Legacy MyPage actions have not been switched to them. Do not treat those features as migrated; profile/favorites/pairing/Google Sync require an implementation and behavior tests or must be disabled explicitly before claiming full cutover. External tokens additionally need a reviewed encryption-key lifecycle before storing them in `external_identity.token_ciphertext`.

The PHP search host can now be configured using `YUKARI_EVERYTHING_HOST`; Compose points it to `host.docker.internal` with a host-gateway entry. This fixes the previous use of the PHP container's own `SERVER_ADDR`, but does not enable Everything's HTTP Server, add indexed folders, configure Windows Firewall, or prove search hits. Operator verification is required. Windows video setup steps are documented in [WINDOWS_VIDEO_QUICKSTART.zh-CN.md](WINDOWS_VIDEO_QUICKSTART.zh-CN.md).

Runtime check on 2026-10-23: Docker DNS resolves `host.docker.internal`, but the PHP container cannot reach port 81 because Everything is not running/listening on the Windows host. The API therefore correctly returns `SEARCH_UNAVAILABLE` for Everything rather than an empty result. MySQL playmode is 1, Legacy autoplay is false, Fastify autoplay is disabled, and the Agent is connected/idle. The real-mpv two-file FIFO/EOF/pause/resume/skip/stop test passed only against an isolated temporary SQLite fixture; this is not evidence that live Everything results currently reach MySQL reservations. No real queue writes were performed.

### Phase 16 MySQL-mode Legacy SQLite retirement

The normal MySQL Compose profile no longer mounts `legacy/php/runtime/queue` or `config.ini` into Fastify. PHP sources are baked into the web image; PHP receives `config.ini` read-only for legacy credential/EasyAuth validation and the dedicated `List.sqlite3` file read-only. Fastify receives MySQL credentials, the Agent state volume, Bridge credentials and a separate `yukari_queue_owner` volume. The latter contains only `node-autoplay.owner`, shared at `/run/queue-owner` in Fastify and `/var/www/html/runtime/queue-owner` in PHP. It is not a database mount.

In `YUKARI_MYSQL_MODE=1`, `kara_config.php` reads config values but skips `initdb`, `updatedb`, WAL mode changes and request-table creation. Priority database initialization and search-word history writes are suppressed. The PHP entrypoint does not chmod legacy database files or launch `queue-wal-anchor.php`; that helper remains only for isolated/legacy SQLite test profiles. The Apache `auto_prepend_file` guard returns 410 for unmigrated business pages before their PHP includes run. Allowed HTTP routes are Everything/YukaLister search, capabilities, signed `exec.php` 竊・Fastify compatibility submissions, admin session validation, and restricted Bridge authentication/context/search operations. Direct old queue, MyPage, favorite, pairing, comment/CMS, Bingo, not-found feedback, metadata-edit, player-control, settings, import/restore and updater routes are disabled. This is intentional Legacy feature retirement, not a MySQL migration of those features.

The old `updatenotice.db` counter is no longer written in MySQL mode. Node reservation/queue/playback writes do not call its Bridge operations. The legacy counter/SSE refresh behavior is therefore unavailable; React remains on Fastify/MySQL state and refetch behavior. PHP search priority overrides are unavailable and default search ordering is used. MyPage/Bingo/Google/metadata-edit capabilities are reported disabled.

`List.sqlite3` remains the sole SQLite search-index exception. In MySQL mode PHP uses the fixed read-only mount path `/var/www/html/List.sqlite3`, ignoring machine-specific legacy path values without rewriting config.ini. PHP opens it with SQLite `mode=ro`; the Apache image does not contain a copied database. The current local file is zero bytes and has no `t_found` table, so YukaLister is not presently usable and capabilities must report it unavailable. Replace it only with an operator-provided valid YukaLister index and recreate the web container if Docker has pinned the previous file mount. Everything search remains independent.

The old PHP source still contains SQLite code for disabled features and the isolated compatibility profile. This does not make it a normal MySQL runtime data source: the MySQL web image has no business database mount, the central PHP guard blocks those entry points, and Fastify's migrated business paths use MySQL without fallback. Existing SQLite files, volumes and backups were not deleted or modified. Production autoplay remains `YUKARI_NODE_AUTOPLAY=0`.

## Phase 17 窶・Windows Media Agent / Everything

| Entry | Owner / path | Input/output | Side effect / permission | Status |
|---|---|---|---|---|
| React `GET /api/v1/search?backend=everything` | Fastify 竊・authenticated Agent poll 竊・local Everything HTTP 1.4 | keyword; returns `{items:[{name,fullpath:"media:<opaque>"}],total}` | user session required; no host paths returned; one of four bounded 8s jobs | Implemented behind `YUKARI_AGENT_SEARCH`; Compose remains `0` until real indexed hit is proven |
| React `POST /api/v1/requests` | Fastify MySQL RequestService | selected opaque `fullpath` token | same-user, 30-minute in-memory resolution to Agent-verified Windows path; existing durable submission receipt and transaction | Implemented; actual Everything hit/reservation not verified |
| Agent `POST /api/v1/agent/next` + `/search-result` | Windows Media Agent | authenticated Bearer, request ID, max 50 results | 3.5s Everything timeout; Agent path realpath must remain beneath configured root; replay/late result rejected | Implemented and unit tested |
| React `GET /api/v1/search?backend=lister` | Fastify 竊・Legacy PHP/YukaLister | keyword; legacy result contract | user session; read-only index | unchanged; current index unavailable |
| Legacy PHP search URL | PHP compatibility search | legacy parameters/response | still retained; HTTP host configuration remains separate | fallback while `YUKARI_AGENT_SEARCH=0` |

Everything's documented JSON options include `json=1`, `count`, `path_column=1`, and `size_column=1` ([official documentation](https://www.voidtools.com/support/everything/http/)). The Agent filters to supported video file types and the configured media root, and returns opaque references. It does not create a songs table or index files itself. Admin System reports only sanitized online/media-root/Everything/mpv status and an allowlisted error code. The Agent lock records its PID; a live or unverifiable PID/legacy lock is never removed.

### Phase 17 live probe (2026-10-23)

Host Everything HTTP `127.0.0.1:81` returned valid JSON. The existing Agent-configured test basename query and a configured-root query each returned zero results; a bounded immediate-directory check found video files under the selected root. This indicates the HTTP endpoint answers but the selected files were not returned by the index/query. The Everything GUI result was not visually inspected. No index scope was changed. The new Agent query implementation was run against the live HTTP server and likewise returned `connected_no_media`, so real search 竊・MySQL reservation 竊・mpv remains unverified. Set the selected media folder in Everything's own index, confirm one known file in the GUI and API, then explicitly set `YUKARI_AGENT_SEARCH=1` to switch React searches.
### Phase 16 螳樊惻驛ｨ鄂ｲ鬪梧噺迥ｶ諤・ｼ・026-10-23・・

譛ｬ谺｡ Docker Engine named pipe 蟇ｹ蠖灘燕蜿鈴剞謇ｧ陦瑚ｺｫ莉ｽ霑泌屓 permission denied・梧悴驥榊ｻｺ謌門星蜉ｨ Compose・悟屏豁､謖りｽｽ霎ｹ逡御ｻ・罰 Compose 髱呎・・鄂ｮ遑ｮ隶､・梧悴莉手ｿ占｡悟ｮｹ蝎ｨ螳樊衍縲ら鴫蟄・Fastify health 霑泌屓 200・帷鴫蟄・PHP capabilities 霑泌屓 200・形everything_search=false`縲～lister_search=false`・梧眺謾ｾ蝎ｨ `autoplay=false`縲Ａ/init.php` 霑泌屓 MySQL 讓｡蠑城｢・悄逧・410・梧悴隶､隸∫噪 Legacy admin session 霑泌屓 401縲８indows 譛ｬ譛ｺ Everything `127.0.0.1:81` 霑泌屓 JSON・御ｽ・PHP capability 謗｢豬倶ｻ榊､ｱ雍･・碁怙蝨ｨ Engine 蜿ｯ隶ｿ髣ｮ蜷惹ｻ・web 螳ｹ蝎ｨ譽譟･ `host.docker.internal:81`縲よ悽谺｡譛ｪ鬪瑚ｯ∵怏謨・Bridge/邂｡逅・遭蜃ｭ謐ｮ縲｀ySQL 蜀呵ｯｻ縲￣HP lint 謌・React E2E縲１layer Agent 霑帷ｨ句ｽ灘燕譛ｪ霑占｡鯉ｼ嬶pv 霑帷ｨ倶ｻ榊ｭ伜惠・梧悴扈域ｭ｢縲よｭ｣蠑剰・蜉ｨ謦ｭ謾ｾ譛ｪ蜷ｯ逕ｨ・梧悴隗ｦ遒ｰ鬚・ｺｦ縲・

\n
### MySQL runtime deployment follow-up (2026-10-23)

Docker Engine access is restored and all images build; the new PHP image passes lint for 298 files. The new Compose generation is not live: Docker refuses the read-only bind mount of the existing local MySQL app credential file due to Windows file ACL, and Compose stopped at `yukari-mysql-bootstrap` recreation. The startup secret helper was corrected to distinguish ENOENT from ACL/I/O failures and never overwrite an unreadable credential. No ACL elevation/ownership change was performed. Existing healthy PHP/API containers remain on the old mount layout, including the Legacy tree and `/run/legacy-db`; they must not be treated as proof that SQLite was removed from runtime. Re-run the existing Windows startup script only after the current account can read the protected secret files and Docker can bind-mount them. No DB/volume was changed.

### Full-access deployment attempt (2026-10-23)

The new PHP image linted all 298 PHP files. A disposable run of that image verified the MySQL-mode guard: search/capabilities execute, the new `host.docker.internal` Everything probe is reachable, YukaLister reports unavailable, disabled Legacy pages return 410, and unauthenticated admin/Bridge calls return 401/403 rather than bypassing auth. A unique unmatched keyword returned an empty valid result; no real media hit was tested.

Compose image build passed, but service recreation stopped because Docker cannot bind-mount the existing local MySQL app credential file under its current Windows ACL. The startup helper now distinguishes missing files from unreadable files and refuses replacement. ACL repair was denied without elevation; none was attempted. The old live services remain running and still show the Legacy tree/workspace mount, Fastify SQLite DB/config mounts, and active `queue-wal-anchor.php`. Fastify also has MySQL settings, but these old mounts mean the SQLite retirement is not yet live. Autoplay remains off. Do not treat previous container health or this disposable PHP probe as acceptance of the new normal Compose runtime.

\n

## Phase 18 窶・Admin-controlled Windows Player Agent launcher

Admin System exposes only fixed `start` and `stop` requests through authenticated Fastify routes. A Windows per-user Launcher uses the Agent bearer credential to poll commands and report status; it reuses an authenticated Agent or starts the fixed built Agent entrypoint with `shell:false`. It does not provide a general shell, accept arbitrary paths, or kill processes by name. The browser can close without affecting the Launcher. When Fastify is unavailable the Launcher retries and waits.

On Stop, Fastify first requests a real player stop for an active test/formal task and waits for Agent feedback; stop is not EOF. Only after the task is no longer active does the Launcher send a fixed local named-pipe shutdown. An unconfirmed stop surfaces an allowlisted error and log location, preserving the process for investigation.

The Windows interactive logon task is optional and **not registered** pending explicit user approval. Dry-run command: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/Install-PlayerAgentLauncher.ps1`. After approval, registration uses the same script with `-Register`. Status and exact-task uninstall scripts are `Get-PlayerAgentLauncherStatus.ps1` and `Uninstall-PlayerAgentLauncher.ps1`. Until registration, launch `npm.cmd --prefix agents/player-agent run start:launcher` after the Agent build/configuration. Formal autoplay remains independently disabled.

### Phase 18 live deployment check (2026-10-23)

The Admin source now renders both fixed controls, including while Launcher is offline, with a clear disabled reason; build output contains the updated UI. However live `127.0.0.1:5174` is served through Docker and still returns the prior transformed SystemPage; `http://127.0.0.1:8080/admin/` serves the prior production bundle. The Docker Engine pipe is denied to this execution identity, preventing rebuild/recreation, so source/build verification is not equivalent to browser availability.

The user approved registering the exact current-user logon task. Both Task Scheduler registration attempts were blocked in this execution context; read-only status says task absent and Launcher not running. The updated installer will register the fixed limited task and start it immediately for current-session verification, but it has not succeeded here. No Agent was launched, no mpv GUI was changed, and no business data/settings were touched.

### Phase 18 actual acceptance (2026-10-23)

The approved limited current-user logon task is registered and Running; the Launcher was verified under its fixed entrypoint. Normal Compose was rebuilt and all five services are healthy. Admin `/system` (Vite 5174) and production `/admin/system` serve the updated SystemPage; both fixed controls were confirmed visible after real Admin login.

A live test found that the Vite boundary initially rejected the new launcher POST. The exact route is now allowlisted, and unauthenticated POST still receives Fastify 401. Actual Admin start reused the authenticated Agent; stop safely disconnected it; Admin start launched a fresh Agent and restored authenticated idle state. The local test-video control opened mpv visibly (nonzero window handle); Fastify observed playing. Stopping Agent during that test ended the task as failed/stopped, not completed/EOF. Agent was restarted and left online. Fastify was briefly unavailable and restarted; Launcher logged the outage and subsequently reauthenticated. Everything reported connected with a media hit. Formal autoplay remained disabled; no real reservation or MySQL business row was written.

Launcher fixes: stop timeout now exceeds Fastify's 15-second heartbeat TTL, and a fresh start command clears the prior action error before attempting startup. API/Agent/Admin builds passed; focused API tests 3/3 and Agent tests 13/13 passed. Full data-writing Edge regression was not run against the live MySQL deployment.

## Phase 19 — Legacy Admin settings and MySQL runtime ownership

The full field-by-field audit is in [LEGACY_ADMIN_SETTINGS_AUDIT.zh-CN.md](LEGACY_ADMIN_SETTINGS_AUDIT.zh-CN.md). Legacy PHP Admin is not a supported management UI in MySQL mode. React Admin calls only Fastify; Fastify persists settings in `app_setting` with revision checking. PHP remains the credential/EasyAuth proof verifier and reservation context provider, not the settings writer.

The MySQL setting set now includes the three previously PHP-owned reservation ordering options (`request_automove`, `request_automove_reset`, `request_automove_midjoin_first`). The explicit setup/bootstrap imports their current allowlisted values once using `INSERT IGNORE`; Fastify then overrides the legacy Bridge's same-named values from MySQL for both React and signed Legacy reservation submissions. Node's existing PHP-oracle-tested `automaticOrder` consumes these settings inside the reservation transaction. Changes affect only new submissions; existing queue rows are not reordered. Missing settings fail closed with a clear setup error; no startup DDL/backfill was added.

Legacy radio forms encode "disabled" as `2` for these options (including `requestlistactivereload`), while the Node API uses effective booleans `0/1`. The explicit import projects `2` to `0`; existing MySQL `2` values are read as off without an automatic database rewrite. A later actual settings change stores normalized values. Unsupported stored values fail closed instead of being treated as enabled.

Only MySQL Node FIFO `playmode=1` can be changed to as an implemented scheduler mode; modes 2–5 remain visible as stored compatibility values, but attempts to switch into them are rejected. Mode 1 still does not start playback by itself. `YUKARI_NODE_AUTOPLAY=0` is the deployment safety gate and remains off in Compose; Agent credentials/availability are reported separately. `startvolume` and the Legacy SSE auto-refresh toggle are retained read-only because current mpv and React runtimes do not apply them; the API rejects attempts to change those ineffective values. Playback/status remains owned by React + Fastify/MySQL + Media Agent; legacy MPC/foobar commands are not reintroduced.

No formal database, reservation, playmode, or active playback state was changed in this phase. Existing MySQL databases need the explicit `--profile setup` bootstrap once to add the three queue-policy values. The test suite does not run that bootstrap automatically. Typecheck/build and focused fake-MySQL policy tests passed; Docker-dependent PHP oracle and browser E2E checks were blocked by the Docker Engine named-pipe access denial in this execution context.

## Phase 20 — mpv live controls and telemetry

| Surface | Owner | Contract / effect | Permission and compatibility |
|---|---|---|---|
| Windows Agent mpv telemetry | Media Agent | Poll mpv JSON IPC for loaded basename, state, duration/position, volume/mute, dynamic audio/subtitle track metadata, and typed connection error; report to existing Agent-state JSON volume | Authenticated Agent only; internal file path is stripped before report; no MySQL task write/event |
| Admin `GET /api/v1/admin/player-agent/mpv` | Fastify snapshot | Returns last Agent heartbeat telemetry and acknowledgment; no MySQL query/write | Admin session only; ordinary user playback response remains sanitized |
| Admin `POST /api/v1/admin/player-agent/mpv-control` | Fastify command slot → Agent | Task-bound seek, volume, mute, audio-track ID, subtitle-track ID/off; one pending command maximum, 10s expiry, typed acknowledgment | Admin session; current Agent ID and task ID must match; validates loaded media, seek duration, and reported track list; never accepts arbitrary IPC or shell text |
| Pause/resume/stop/skip/EOF | Existing task scheduler + Agent | Continues through existing task-aware commands; only real EOF completes; stop/skip/error remain distinct | Formal task and queue projection stay MySQL-owned; test tasks remain isolated in the Agent-state JSON volume |

Admin reads mpv state every second and queue/system task state every 3.5 seconds. A manual mpv GUI action is reflected by the next telemetry query. Dynamic mpv IDs are used for track selection; no fixed ID assumption is made. Switching audio tracks is not pitch shifting. Runtime pitch shift is exposed as bounded ±6-semitone controls in Admin and the authenticated user Player page, using mpv's `rubberband` filter and `af-command set-pitch`; the Agent advertises the capability only when it confirms the labeled filter in mpv. Builds without Rubber Band report the control unavailable. Per-reservation `keychange` is supported in MySQL mode: React records an integer from -6 to +6 in the existing `reservation.keychange` field, Fastify passes it with a newly claimed task, and Agent applies it before unpausing mpv. If the filter cannot be installed for a nonzero request, Agent fails that task rather than playing in the wrong key. Legacy EasyKeyChanger behavior that writes later manual changes back to the active reservation remains unmigrated. Playback speed remains unsupported. No PHP/Legacy playback-control feature was re-enabled; no schema change was needed.

### User player controls

The user app adds a `/player` route backed by `GET /api/v1/playback/agent` and `POST /api/v1/playback/mpv-control`. It exposes sanitized live state and task-bound pause/resume, seek, volume/mute, dynamic audio/subtitle track selection, audio delay, and fullscreen controls only while a formal queue task is actively playing or paused. The API still requires a user session and a current Agent/task match; it rejects test tasks and never returns a host path or media filename. Stop, skip, scheduling, and task lifecycle controls remain Admin-only so a regular user cannot interrupt or advance the shared queue. Audio delay is bounded to ±10 seconds; pitch/tempo and Legacy MPC/foobar-specific effects remain unsupported.

User and Admin telemetry both use the Agent heartbeat snapshot and do not write MySQL on polling. The user page polls once per second while visible. User controls share the typed mpv IPC allowlist and wait for the Agent acknowledgment; unavailable Agent/task state disables the controls and displays the actual error.

mpv itself provides `pitch` and `speed` properties, with audio correction filters such as `scaletempo2` and optional `rubberband`; those change audio processing and have range/CPU/quality tradeoffs. Phase 20 does not expose them until karaoke-file audio quality and synchronization are tested. See the [mpv reference manual](https://mpv.io/manual/stable/#options-pitch) for the documented controls and filters.

The current API/Agent/Admin focused tests and builds pass. Live Docker deployment, Edge E2E, and Windows GUI/IPC control could not be rerun in this execution because Docker Engine named-pipe access is denied. The Phase 19 test backlog classification is recorded in `docs/REFACTOR_PROGRESS.md`: the stale MySQL guard assertions now verify the 410 contract, while the remaining PHP oracles and write tests require Docker plus the marker-protected isolated fixture; they are not waived or skipped.

### Phase 19B — current settings owner

| Setting/operation | Current owner and effect | Status |
| --- | --- | --- |
| `playmode` 1 / 2 | React Admin → Fastify → MySQL `app_setting`; Node queue claim uses FIFO EOF advancement in 1, one-shot Admin starts in 2 | Implemented; selecting a mode does not start playback |
| Queue scheduler start/stop | Admin Queue console → authenticated Fastify → durable `scheduler_enabled`; gated by `YUKARI_NODE_AUTOPLAY` | Implemented; deployment default remains off |
| `startvolume` | React Admin → MySQL; Agent receives and applies value once on a fresh queue task | Implemented; live mpv volume is independent |
| `request_automove`, reset, midjoin-first | Fastify reads MySQL values for both React and signed Legacy User reservations; Node applies to the new reservation transaction | Implemented; existing rows are not rearranged |
| Legacy Admin settings/player pages | No longer supported in MySQL mode | Retired; use React Admin |
| Legacy PHP User search and point-song path | Existing compatibility endpoints forward authenticated reservation requests to Fastify/MySQL; search retains existing Legacy/Everything owner | Kept enabled |

The persisted mode change is rejected during scheduler ownership, a pending manual start, or an active playback task. `YUKARI_NODE_AUTOPLAY=0` blocks arming/starting even if a strategy is saved. There is no schema change in this phase; the two scheduler keys are seeded as false by the explicit MySQL bootstrap, never by API startup.

#### Legacy `/init.php` visibility in MySQL mode

The historical PHP settings interface remains visible at `/init.php` after its existing administrator authentication. This is a read-only presentation path: MySQL-mode requests must be GET, all query/form parameters are discarded before page rendering, the old settings form is disabled, and the password field does not display its stored value. Non-GET submissions are rejected with 410. The PHP settings serializer is not invoked; React Admin → Fastify → MySQL remains the only writer. The Apache MySQL guard permits only this GET page and continues to reject its POST handler.
## Phase 21：LAN 手机 User Web 入口

新增 `user-lan` 专用 Nginx 服务（默认 host TCP 8181）。它只提供 production `/user/` 静态应用和固定方法/路径的 User API 代理；管理、Legacy PHP、Agent/Launcher、通用健康检查及数据库在该入口均不可达。旧 PHP 搜索/预约入口没有被手机 LAN 代理使用。Everything 搜索仍由 Fastify → 已认证 Windows Media Agent 执行，浏览器不直连 Everything，也不接触 Windows 共享目录。

| 能力 | Owner / 路径 | 访问边界 |
|---|---|---|
| LAN 地址候选 | Windows Media Agent 通过认证心跳上报，Admin-only Fastify 状态返回 | 仅 RFC1918 IPv4、剔除虚拟/VPN/tunnel 接口；普通用户状态不含地址 |
| 手机 UI 与二维码 | 静态 User Web + React Admin System | QR 使用当前 Agent 地址及 `USER_LAN_PORT`，IP 变化后随 Agent 心跳更新 |
| 手机 User API | 同源 `/api/v1` → Nginx 固定 allowlist → Fastify | 独立用户会话与 CSRF；LAN Origin 仅接受精确代理标记、Origin/转发 Host 一致及配置端口 |
| 搜索、预约、队列、公开播放态 | Fastify 原有业务 Owner；搜索由 Media Agent/Everything | MySQL 写规则和去重契约不变；此阶段未创建预约测试数据 |

此入口不会将 `/admin`、旧 PHP 页面、数据库、Fastify 管理/Agent 接口直接暴露到 LAN。Agent 不在线或未报告可用地址时 Admin 不生成猜测 URL。防火墙仅作说明，未自动增规则。Phase 21 的合成移动端 E2E 与只读真实搜索 E2E 已通过，但实体手机扫码和该手机 Wi-Fi/防火墙路径尚待手动验收。

### Phase 23 播放控制延迟

User `/player` 通过同源 Fastify HTTP 获取公开脱敏 mpv 状态并提交任务绑定控制；浏览器不会直连 Windows Agent/mpv。空闲时维持 1 秒状态刷新，控制等待期间临时加快到 250 ms，控制结束后恢复；Agent 状态只在 Fastify 已收到报告后显示，位置预测不得改变 playing/EOF 事实。LAN Edge 只读实测状态 GET 为 200，单次请求最大约 2.8 ms（本机经 LAN Nginx 入口），390px/1365px 无横向溢出。

命令执行由 Agent 轮询 `/api/v1/agent/next`。新 Agent 源码在拥有活动任务时改为 250 ms 检查命令、空闲 1.5 秒；遥测 1 Hz，MySQL 15 秒 lease 只在余 5 秒内续写，活动任务轮询不锁 `app_setting`。无需浏览器 WebSocket：当前状态 API 请求 RTT 不是主延迟；浏览器 WS 也无法加快 Agent 拉取控制的路径。API/LAN 镜像已部署；Agent bundle 已构建，但运行中的 Windows Agent 尚待通过 Admin → System 安全停止/启动后加载。未对正式播放发控制命令，实际命令 RTT仍待实机验证。
## Phase 22：房间连接体验与 Legacy 对照

| Legacy 功能 | Legacy Owner / 存储 | React/Fastify 对应 | 状态 |
|---|---|---|---|
| 本地连接 QR / Host/IP 推导 | `toolinfo.php`；运行请求 Host/`SERVER_ADDR` | Agent 上报私网地址；Admin 浏览器探测后生成 LAN QR | 已有 Phase 21；现在探测未成功不发 QR |
| 在线 `globalhost` 检查 | `toolinfo.php` 读 `config.ini`，受 `connectinternet` 控制并做服务器 HTTP 探测 | MySQL `app_setting` 保存自定义 HTTPS `/user/` URL；Admin 浏览器调用公开 nonce 探针 | 已实现设置和当前浏览器连通性，不负责搭建公网网络 |
| 在线 WireGuard / pfwd | `pfwd_settings.php`、`autoplayctrl.php` 调 Windows WireGuard 进程或旧 pfwd | 无 Node/React 管理控制 | Legacy-only，不由新 Admin 启动/停止 |
| EasyAuth 在线关键字 | Legacy ConfigAuth，旧 `toolinfo.php` 曾把关键字放入 URL | 无 URL 口令，也无新代码将管理口令加入 QR | 暂缓；新 HTTPS 公开入口的用户注册/共享口令需要单独设计 |
| 别部屋切换 | `init.php` 的 `roomurl`/`roomurlshow`，Legacy 页面选择不同 URL | 新 User 顶栏显示单个 MySQL 实例房间名；另一个房间打开另一个实例 URL | 多租户/共享数据库未实现，按实例隔离 |
| 连接状态和 QR | Legacy `toolinfo.php` 服务器端探测；`capabilities.php` 给出房间名/列表 | Admin System 状态 + 浏览器 nonce 探测；User capabilities 展示房间名 | 已实现当前浏览器实测；公网普遍可达仍需运营者/手机验收 |

Phase 22 新增的 `GET/PUT /api/v1/admin/connection-entry` 受管理会话及 CSRF 保护，复用 MySQL `app_setting` 键值存储，不增加 Schema。公开 `GET /api/v1/user/entry-probe?nonce=<uuid>` 仅回显随机 nonce 和固定服务标识，无身份、路径、配置或业务数据；其唯一 CORS 通配头仅适用于该探针。自定义公网 User Origin 必须等于显式配置的 HTTPS URL、首选模式为 public、Host 与专用代理转发头一致。LAN User 白名单仍只代理现有路径和探针，所有管理/Legacy/Agent/MySQL 路由保持拒绝。

验证结果：设置 URL 校验、MySQL 仓储保存、HTTPS Secure Cookie、精确 Origin/Host、管理员仍拒绝、探针响应测试与 Phase 21 LAN Origin 共 4/4；相关项目 typecheck/build 和 Agent 20/20 通过。正常 Compose 已部署，Admin 实际登录后显示 LAN QR，User LAN 390px Edge 1/1。Phase 22 尚无公网域名/隧道配置，不能宣称公网入口已通；更广 API suite 在普通 Compose 下有 17 项失败/3 项跳过（PHP oracle/隔离写测试需要专用挂载/fixture），需按隔离测试文档复跑。

## Phase 24：MySQL 播放异常恢复

正式播放任务仍由 Fastify/MySQL 单独拥有，Agent 是唯一 mpv 执行端。MySQL-mode Fastify 启动时无论 `YUKARI_NODE_AUTOPLAY` 是否开启，都会把残留的 `claimed/playing` 转成 `uncertain`、保留预约且取得 owner fence；部署开关仍只控制新任务领取。此状态下 Agent 仅在 task.agent_id 匹配且同一 mpv 实际报告目标文件仍 playing/paused 时恢复原任务，不重开视频、不增加 playtimes；真实 EOF 事件可在重启后幂等补记。若播放器 idle、已停止或实际打开其他媒体，则只把旧任务终结为 failed/停止中，不把其他文件停掉，也不宣称 EOF。Agent 离线或 IPC 状态未知时保持 uncertain、阻止新领取。

Admin Queue 为最新失败/未决尝试提供 `POST /api/v1/admin/playback/tasks/:taskId/recheck|retry|handled|confirm-inactive`。恢复任务采用 LEFT JOIN 显示，以免预约已删除时隐藏仍占用队列 owner fence 的任务。孤立任务只能关闭，不能重播或重建预约。状态检查读取 Agent 快照，不将请求失败推断为停止。若 Agent/IPC 无法恢复，管理员可通过单独确认操作记录“我确认当前没有播放”的人工证明；此操作把 uncertain 终结为 failed/stopped，在 `playback_event` 记录理由，不发播放器命令、不宣称 EOF、不增加 playtimes。这个人工证明允许之后重试或标记处理，但管理员必须先确认 mpv 确实没有播放。重试把原预约恢复为未再生并追加 `retry_requested`，不删除历史或直接创建并行任务，后续新尝试仍按正常队列/FIFO领取；重复操作由事件键和状态条件拒绝。人工处理保留预约，投影为停止中并记录简短理由，不增加 playtimes。

没有 Schema 迁移。Admin 只收到任务错误码/固定错误消息、预约展示字段和 Agent/mpv 脱敏状态，不返回媒体路径或凭据。Legacy PHP 不拥有恢复操作，PHP 旧播放器控制仍关闭。失败报告按既有安全规则关闭自动调度。隔离仓储测试覆盖真实 EOF 后重启补报、同 Agent active re-adopt、inactive fail-closed、重试幂等及人工处理不改播放次数。Docker Engine 在当前执行沙箱返回 named-pipe `permission denied`，因此真实 MySQL 合成容器、Edge E2E 与部署重启未能执行；不可把单元测试视为现场恢复验收。
### Phase 25 — 参与者昵称与代点身份

| 能力 | Owner / 路由 | 存储与权限 | 迁移状态 |
| --- | --- | --- | --- |
| 当前浏览器身份 | Fastify `YkariUserID` → `YukariUserSession` | 稳定 UUID 是请求 actor；昵称不参与认证 | 保留既有机制 |
| 个人昵称 | React User → `GET/PUT /api/v1/user/profile` | MySQL `app_user.userid/displayname`；只能改当前 actor 的资料 | 已实现 |
| 选择代点参与者 | React User → `GET /api/v1/user/participants`，预约 `participantId` | 只返回现有参与者的 ID/昵称；Fastify 校验 ID 存在。session owner、receipt owner、历史 actor 不变 | 已实现；仅 MySQL 模式 |
| 预约参与者关联 | Fastify `MysqlRequestRepository` | `reservation.participant_userid` 指向 `app_user.userid`；旧预约为 NULL，不根据昵称或历史猜测回填 | `003-reservation-participant.sql` 已由 Compose migration job 应用到当前开发 MySQL；既有 25 条预约均保持 NULL |
| 管理参与者 | React Admin `/participants` → `GET /api/v1/admin/participants`、`PUT /api/v1/admin/participants/:id` | 管理 session；显示参与者关联预约数与由该浏览器发起的历史数。改昵称不回写旧预约 `singer`/历史；不提供合并或改属操作 | 已实现；API 依赖新增列迁移 |
| Legacy PHP User | 原 PHP → 签名 `exec.php` 兼容入口 | 缺少 participantId 时 Node 将 actor `userid` 作为新预约参与者；PHP 仍不获得 React 的任意身份选择能力 | 兼容保留，未更改 PHP 认证 |

**身份边界：** actor 是谁由 HttpOnly 用户会话决定；参与者只决定预约显示及参加者归属。选择他人不授予读取私人历史、修改或删除他人预约的能力。相同昵称的 UUID 保持独立。一次性 MySQL migration 仅在 `reservation` 增加可空 `participant_userid`、索引和 `ON DELETE SET NULL` 外键；不新建参与者表，不改动既有预约。当前开发 Compose 已应用 Migration，并已部署 API/User/Admin。真实管理登录后读取参与者及真实手机预约验收尚未完成；隔离库 E2E 仍需专用 fixture，不得在当前队列执行写测试。
### Phase 28A Web Gateway

Canonical HTTP ingress rules now live in `gateway/`. Apache remains the local-only Legacy PHP/React entry at `127.0.0.1:8180`. The default LAN Nginx gateway on port 8181 serves React User and Admin routes, with exact method/path API allowlists. Fastify permits LAN Admin Origin only from the gateway's dedicated marker plus matching private IPv4 host/port; Admin session and CSRF authorization remain server-side. No PHP route, MySQL, Agent, Launcher, mpv IPC, or Everything endpoint is exposed on the LAN gateway.

The optional Compose `tunnel` profile has a second internal Nginx origin that serves only `/user/*` and the User API allowlist. `cloudflared` is profile-gated and has no host-published port. Normal Compose never starts it. A real public route still requires a locally held Tunnel token and external hostname/origin configuration; neither is provisioned by this repository.
