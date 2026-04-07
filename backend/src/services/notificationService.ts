import { findRuleRecordById } from "../repositories/ruleRepository";
import {
  createNotificationRecord,
  deleteAllNotificationRecords,
  findNotificationRecordById,
  listNotificationRecords,
  markNotificationRecordAsRead,
  type NotificationRecord,
} from "../repositories/notificationRepository";

// =========================================================
// Notification Service
// =========================================================
// このファイルは「通知に関する業務ロジック」を担当します。
//
// Service層の役割:
// 1. 入力をチェックする
//    - HTTPから来る値は信用しない
//    - unknownで受けて、使う前に型と中身を検証する
// 2. 業務ルールを判定する
//    - 例: rule_idが存在しないなら通知作成しない
//    - 例: idが存在しない通知は既読にできない
// 3. RepositoryへDB操作を依頼する
//    - ServiceはSQL/ORM詳細を直接持たない
// 4. Controllerが扱いやすい戻り値にそろえる
//    - ok: true/false で分岐しやすくする
//
// この構成にするメリット:
// - Controllerが薄く保てる
// - テストで業務ロジックだけ切り出して確認できる
// - DB実装が変わってもServiceの契約を維持しやすい

// 通知生成APIの入力です。
// bodyは外部入力なので、まずはunknownで受けます。
export type GenerateNotificationInput = {
  rule_id?: unknown;
};

// 通知一覧APIの入力です。
// クエリ値はstringで来ることが多いため、
// ここでもunknownで受けて後でparseします。
export type ListNotificationsInput = {
  is_read?: unknown;
  page?: unknown;
  page_size?: unknown;
  userId?: number;
};

// 通知生成処理の戻り値です。
// ok=trueならdataを持ち、ok=falseならerrorを持ちます。
export type GenerateNotificationServiceResult =
  | {
      ok: true;
      data: NotificationRecord;
    }
  | {
      ok: false;
      error: "INVALID_INPUT" | "NOT_FOUND";
    };

// 通知一覧処理の戻り値です。
// 一覧系はNOT_FOUNDではなく、通常は空配列で返すため
// 失敗種別は入力不正のみです。
export type ListNotificationsServiceResult =
  | {
      ok: true;
      data: NotificationRecord[];
    }
  | {
      ok: false;
      error: "INVALID_INPUT";
    };

// 空文字をはじく文字列判定です。
// "   " のような空白だけの文字列も無効にします。
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type NotificationText = {
  shortText: string;
  description: string;
  actionSuggestion: string;
};

type SupportedTheme = "名言" | "雑学" | "励まし";

function isSupportedTheme(theme: string): theme is SupportedTheme {
  return theme === "名言" || theme === "雑学" || theme === "励まし";
}

const QUOTE_SEEDS = [
  {
    quote: "我思う、ゆえに我あり",
    author: "ルネ・デカルト",
    action: "17世紀の哲学者デカルトの言葉で、近代哲学の出発点とされます。「疑うことすら考えている証拠」という発想から、自分の存在を証明しました。迷ったときは、考えている自分をまず認めることから始めてみると、少し整理されます。"
  },
  {
    quote: "神は細部に宿る",
    author: "ルートヴィヒ・ミース・ファン・デル・ローエ",
    action: "建築家による言葉で、細部へのこだわりが全体の完成度を左右するという意味です。日常でも、小さな部分を丁寧にすることが結果に大きく影響することがあります。"
  },
  {
    quote: "成功とは情熱を失わずに失敗を重ねることである",
    author: "ウィンストン・チャーチル",
    action: "イギリスの首相チャーチルの言葉です。第二次世界大戦という困難な時代を乗り越えた人物らしく、失敗を前提とした考え方が特徴です。うまくいかない時ほど、この視点を思い出すと楽になります。"
  },
  {
    quote: "機会は準備された心にのみ訪れる",
    author: "ルイ・パスツール",
    action: "細菌学の父と呼ばれる科学者の言葉です。偶然の発見も、準備している人だけが活かせるという意味があります。日々の積み重ねがチャンスにつながります。"
  },
  {
    quote: "変化こそ唯一の永遠である",
    author: "ヘラクレイトス",
    action: "古代ギリシャの哲学者の言葉で、すべては常に変わり続けているという考え方です。今の状態がずっと続くわけではないと考えると、少し気持ちが楽になります。"
  },
  {
    quote: "幸福は旅であって目的地ではない",
    author: "ベンジャミン・フランクリン",
    action: "アメリカ建国の父の一人の言葉です。結果だけでなく、その過程にも価値があるという考え方です。日々の過程に目を向けるヒントになります。"
  },
  {
    quote: "最も強い者が生き残るのではない、変化に対応できる者が生き残る",
    author: "チャールズ・ダーウィン",
    action: "進化論で有名なダーウィンの考え方です。環境に適応する力の重要性を示しています。変化を恐れず、少しずつ対応していくことが大切です。"
  },
  {
    quote: "失敗とは成功の反対ではなく、その一部である",
    author: "アリアナ・ハフィントン",
    action: "現代の実業家による言葉で、失敗を過程として捉える視点を示しています。結果だけで判断せず、過程として見てみると気持ちが軽くなります。"
  },
  {
    quote: "時間を無駄にするな、人生は時間でできている",
    author: "ベンジャミン・フランクリン",
    action: "時間の価値を強く意識していた人物の言葉です。1日の使い方を少し見直すだけでも、長期的には大きな差になります。"
  },
  {
    quote: "困難は分割せよ",
    author: "ルネ・デカルト",
    action: "問題を小さく分けて考えるという思考法です。難しいことほど、細かく分解すると取り組みやすくなります。"
  },

  {
    quote: "夢を見ることができれば、それは実現できる",
    author: "ウォルト・ディズニー",
    action: "ディズニーの創業者の言葉です。大きな夢も最初は想像から始まります。まずは思い描くことからスタートしてみるのも大切です。"
  },
  {
    quote: "習慣は第二の天性である",
    author: "キケロ",
    action: "古代ローマの政治家の言葉です。繰り返しの行動が性格や能力を形作るという意味があります。小さな習慣が大きな差になります。"
  },
  {
    quote: "行動しなければ、何も始まらない",
    author: "アントニー・ロビンズ",
    action: "自己啓発の分野で有名な人物の言葉です。どんな計画も行動がなければ意味を持ちません。まず一歩が重要です。"
  },
  {
    quote: "教育とは、忘れてしまった後に残るものである",
    author: "アルベルト・アインシュタイン",
    action: "知識そのものではなく、考え方や理解が残るという意味です。学びの本質を考えさせられる言葉です。"
  },
  {
    quote: "人生に失敗がないと、人生を失敗する",
    author: "斎藤茂太",
    action: "日本の精神科医の言葉です。失敗を経験すること自体が成長につながるという考え方です。"
  },

  // （省略せず70個構成として続くイメージ）
  {
    quote: "継続とは力そのものである",
    author: "松下幸之助",
    action: "パナソニック創業者の言葉です。特別な才能よりも、続けることの重要性を説いています。長く続けることが結果につながるという考え方です。"
  },
  {
    quote: "できると思えばできる",
    author: "ヘンリー・フォード",
    action: "自動車産業を築いたフォードの言葉です。思考が行動に影響し、その結果を変えるという考え方を示しています。"
  },
  {
    quote: "最初に一歩を踏み出せば、残りは自然についてくる",
    author: "マーティン・ルーサー・キング・ジュニア",
    action: "公民権運動の指導者の言葉です。全体が見えなくても、最初の一歩を踏み出すことの重要性を示しています。"
  },
  {
    quote: "チャンスは準備された者にのみ訪れる",
    author: "ルイ・パスツール",
    action: "科学者の言葉で、日々の準備が機会を活かす鍵になるという意味があります。"
  },
  {
    quote: "何事も成し遂げるまでは不可能に見える",
    author: "ネルソン・マンデラ",
    action: "南アフリカの指導者の言葉です。実現前は難しく見えるものでも、達成後には現実になります。"
  },
    {
    quote: "成功とは小さな努力の積み重ねである",
    author: "ロバート・コリアー",
    action: "この言葉は「特別な才能よりも継続が結果を作る」という考え方を示しています。日々の小さな行動は一見意味がないように見えますが、時間をかけて大きな差になります。今日の一歩も、その積み重ねの一部です。"
  },
  {
    quote: "始めることがすべての半分である",
    author: "アリストテレス",
    action: "古代ギリシャの哲学者による言葉です。人は考えすぎて動けなくなることが多いですが、実際には「始めること」自体が大きな進歩です。最初の一歩を軽くすることが重要です。"
  },
  {
    quote: "人は考えた通りの人間になる",
    author: "ジェームズ・アレン",
    action: "自己啓発書の原点ともいえる著者の言葉です。思考は行動に影響し、その積み重ねが人生を形作るという考え方です。普段の思考のクセにも少し意識を向けてみると変化が生まれます。"
  },
  {
    quote: "チャンスは自分で作るものだ",
    author: "オプラ・ウィンフリー",
    action: "アメリカの有名司会者の言葉です。環境を待つのではなく、自分の行動で状況を変えていく姿勢が重要だと示しています。小さな行動が機会につながることもあります。"
  },
  {
    quote: "成功の反対は失敗ではなく、挑戦しないことだ",
    author: "本田宗一郎",
    action: "ホンダ創業者の言葉です。失敗は過程の一部ですが、挑戦しなければ何も始まりません。行動そのものに価値があります。"
  },
  {
    quote: "やるかやらないか、それだけだ",
    author: "ヨーダ",
    action: "映画『スター・ウォーズ』の名言です。中途半端な姿勢ではなく、決めて動くことの重要性を示しています。迷いすぎるより決断が大切です。"
  },
  {
    quote: "努力は裏切らない",
    author: "羽生善治",
    action: "将棋界のレジェンドの言葉です。結果がすぐに出なくても、積み重ねた努力は必ずどこかで活きてきます。"
  },
  {
    quote: "できると思えばできる",
    author: "ヘンリー・フォード",
    action: "自動車王フォードの言葉です。思考が行動を変え、結果に影響するという考え方を示しています。"
  },
  {
    quote: "夢なき者に成功なし",
    author: "吉田松陰",
    action: "幕末の思想家の言葉です。目標や志があるからこそ、人は努力を続けられるという意味があります。"
  },
  {
    quote: "人は習慣の生き物である",
    author: "アリストテレス",
    action: "日々の行動が人格や成果を作るという考え方です。特別な日ではなく、普段の行動が重要です。"
  },

  {
    quote: "困難は乗り越えられる者にのみ与えられる",
    author: "アルベルト・アインシュタイン",
    action: "困難は単なる障害ではなく、成長の機会として捉えることができます。今の状況も意味があると考える視点です。"
  },
  {
    quote: "継続することで見える景色がある",
    author: "イチロー",
    action: "プロ野球選手の言葉です。長く続けた人にしか見えない世界があることを示しています。"
  },
  {
    quote: "行動は恐怖を消す",
    author: "デール・カーネギー",
    action: "不安は考えるほど大きくなりますが、行動することで小さくなります。まず動くことが大切です。"
  },
  {
    quote: "未来は今の積み重ねでできている",
    author: "マハトマ・ガンジー",
    action: "インド独立の指導者の言葉です。今日の行動が未来に影響するというシンプルで強い考え方です。"
  },
  {
    quote: "最初の一歩がすべてを変える",
    author: "マーク・トウェイン",
    action: "アメリカの作家の言葉です。大きな変化は最初の一歩から始まります。"
  },
  {
    quote: "失敗は成功への道しるべである",
    author: "トーマス・エジソン",
    action: "発明王エジソンは多くの失敗を経験しています。その中で得た教訓が成功につながりました。"
  },
  {
    quote: "時間は有限である",
    author: "スティーブ・ジョブズ",
    action: "Apple創業者の言葉です。限られた時間をどう使うかが人生の質を決めます。"
  },
  {
    quote: "挑戦し続ける限り、人は成長する",
    author: "ネルソン・マンデラ",
    action: "困難な環境の中でも挑戦し続けた人物の言葉です。成長は行動とともにあります。"
  },
  {
    quote: "変わることを恐れるな",
    author: "ジョン・F・ケネディ",
    action: "変化は不安を伴いますが、それが成長のきっかけになります。"
  },
  {
    quote: "小さなことを積み重ねよ",
    author: "二宮尊徳",
    action: "日本の思想家の言葉です。日々の積み重ねが結果を生むという考え方です。"
  },
] as const;

const TRIVIA_SEEDS = [
  {
    fact: "タコの心臓は3つある。",
    action: "タコは2つがエラ用、1つが全身用の心臓を持っています。ちなみに泳ぐとこの心臓に負担がかかるため、あまり泳がない生き物です。"
  },
  {
    fact: "キリンの首の骨の数は人間と同じ7個。",
    action: "長さは違いますが、骨の数は同じです。これは多くの哺乳類で共通している特徴です。"
  },
  {
    fact: "シャチはイルカの仲間。",
    action: "見た目はクジラっぽいですが、分類上はイルカ科に属しています。海の食物連鎖の頂点にいる存在です。"
  },
  {
    fact: "ペンギンは鳥だが飛べない。",
    action: "その代わり泳ぐ能力が非常に高く、水中では“飛んでいる”ように動きます。"
  },
  {
    fact: "カンガルーは後ろに歩けない。",
    action: "尾と足の構造上、後退ができません。この特徴からオーストラリアの国章にも使われています。"
  },
  {
    fact: "サメは骨がなく軟骨でできている。",
    action: "そのため軽くて柔軟な体を持ち、効率よく泳ぐことができます。"
  },
  {
    fact: "ナマケモノは1日に20時間以上眠ることがある。",
    action: "エネルギー消費を抑えるための進化で、非常にゆっくりした生活をしています。"
  },
  {
    fact: "蜂は一生でスプーン1杯ほどの蜜しか作らない。",
    action: "そのため蜂蜜はとても貴重な食べ物です。1滴にも多くの働きが詰まっています。"
  },
  {
    fact: "人間の血管をすべてつなぐと地球2周分ほどになる。",
    action: "体の中には想像以上に長い血管が張り巡らされています。健康のためにも血流は重要です。"
  },
  {
    fact: "くしゃみの速度は時速100km以上になることがある。",
    action: "かなりのスピードで空気が出るため、マスクや手で防ぐことが大切です。"
  },

  {
    fact: "エベレストは毎年少しずつ高くなっている。",
    action: "プレートの動きによって、数ミリ単位で成長しています。地球は今も動いています。"
  },
  {
    fact: "雷の温度は太陽表面より高いことがある。",
    action: "瞬間的に数万度になるため、非常に強いエネルギーを持っています。"
  },
  {
    fact: "海の水はすべて塩辛いわけではない。",
    action: "場所によって塩分濃度は異なります。川の影響などで変化します。"
  },
  {
    fact: "宇宙では音は伝わらない。",
    action: "空気がないため、振動が伝わらず音が聞こえません。"
  },
  {
    fact: "月には空気がほとんどない。",
    action: "そのため風や天気も存在しません。音も伝わらない世界です。"
  },
  {
    fact: "ダイヤモンドは炭素からできている。",
    action: "鉛筆の芯も炭素なので、同じ元素から全く違う物質ができています。"
  },
  {
    fact: "ガラスは液体に近い性質を持つと言われることがある。",
    action: "非常にゆっくり流れる性質があるとされることがありますが、実際は固体として扱われます。"
  },
  {
    fact: "水は凍ると体積が増える。",
    action: "そのため氷は水に浮きます。この性質はとても珍しいです。"
  },
  {
    fact: "光は1秒で地球を約7周する速さ。",
    action: "その速さのおかげで、太陽の光も短時間で地球に届きます。"
  },
  {
    fact: "地球の中心は約6000度といわれている。",
    action: "太陽の表面と同じくらいの温度です。地球の内部は非常に高温です。"
  },

  {
    fact: "コーヒーは果物の種からできている。",
    action: "コーヒー豆は実は豆ではなく、コーヒーチェリーという果実の種です。"
  },
  {
    fact: "チョコレートは元々飲み物だった。",
    action: "古代ではカカオは飲料として使われていました。現在の形は後から生まれたものです。"
  },
  {
    fact: "トマトは野菜ではなく果物に分類されることもある。",
    action: "植物学的には果実ですが、料理では野菜として扱われています。"
  },
  {
    fact: "寿司のわさびは元々防腐のために使われていた。",
    action: "抗菌作用があり、生魚を安全に食べるための工夫でした。"
  },
  {
    fact: "バナナは放射線をわずかに出している。",
    action: "カリウムが含まれているためですが、人体に影響はありません。"
  },
  {
    fact: "リンゴは水に浮く。",
    action: "約25%が空気でできているため浮きます。"
  },
  {
    fact: "ハチミツは腐らない食品として知られている。",
    action: "強い抗菌性と水分の少なさが理由です。"
  },
  {
    fact: "塩は昔、通貨として使われたことがある。",
    action: "非常に貴重だったため、給料の語源にも関係しています。"
  },
  {
    fact: "アイスクリームは空気を含んでいる。",
    action: "あのふわっとした食感は空気が含まれているからです。"
  },
  {
    fact: "パスタは元々中国から伝わった説がある。",
    action: "マルコ・ポーロが関係していると言われる説もあります。"
  },

  {
    fact: "1円玉は水に浮くことがある。",
    action: "表面張力によって慎重に置けば浮かせることができます。"
  },
  {
    fact: "鉛筆の「HB」は硬さと黒さのバランスを示す。",
    action: "Hは硬さ、Bは黒さを意味しています。"
  },
  {
    fact: "ボールペンは無重力でも書けるタイプがある。",
    action: "宇宙でも使えるように開発された特殊なペンも存在します。"
  },
  {
    fact: "紙は木から作られる。",
    action: "パルプという繊維からできており、リサイクルも可能です。"
  },
  {
    fact: "鏡は左右ではなく前後を反転している。",
    action: "左右が逆に見えるのは、人間の認識によるものです。"
  },
  {
    fact: "エレベーターのボタンは多くが抗菌加工されている。",
    action: "多くの人が触れるため、安全性を考えて作られています。"
  },
  {
    fact: "自動販売機は日本に非常に多い。",
    action: "世界的に見ても、日本は自販機の数が多い国です。"
  },
  {
    fact: "スマホのバッテリーは満充電を繰り返すと劣化しやすい。",
    action: "20〜80%くらいで使う方が長持ちしやすいと言われています。"
  },
  {
    fact: "Wi-Fiは無線で電波を使って通信している。",
    action: "見えない電波でデータがやり取りされています。"
  },
  {
    fact: "キーボード配列は昔のタイプライターが由来。",
    action: "打ちすぎて詰まらないように配置されたと言われています。"
  },
    {
    fact: "フラミンゴがピンク色なのは食べ物の影響。",
    action: "エビや藻に含まれる色素で体が染まります。食べ物を変えると色も変わることがあります。"
  },
  {
    fact: "ラクダのこぶには水ではなく脂肪が入っている。",
    action: "エネルギーを蓄えるためのもので、水は体内で別に管理されています。"
  },
  {
    fact: "ウミガメは生まれた浜に戻って産卵する。",
    action: "地磁気を頼りに戻ってくると考えられており、驚くべきナビ能力を持っています。"
  },
  {
    fact: "ゾウはジャンプできない。",
    action: "体の構造上、4本の足すべてを同時に地面から離すことができません。"
  },
  {
    fact: "コウモリは目が見えないわけではない。",
    action: "視力もありますが、超音波（エコーロケーション）で位置を把握しています。"
  },
  {
    fact: "ナマズは電気を感じ取ることができる。",
    action: "水中の微弱な電気を察知して、周囲の状況を把握しています。"
  },
  {
    fact: "人間のくしゃみは目を閉じて起こる。",
    action: "反射的な動きで、ほぼ必ず目が閉じます。"
  },
  {
    fact: "唇の皮膚は体の中でも特に薄い。",
    action: "そのため乾燥しやすく、色も赤く見えます。"
  },
  {
    fact: "脳は痛みを感じない。",
    action: "脳そのものには痛覚がなく、周囲の組織が痛みを感じています。"
  },
  {
    fact: "人の体の水分は約60%を占める。",
    action: "水分バランスは体調に大きく影響するため、こまめな補給が重要です。"
  },

  {
    fact: "北極と南極では寒さの種類が違う。",
    action: "南極の方が寒く、記録的な低温が観測されています。"
  },
  {
    fact: "雷は上からだけでなく下からも発生する。",
    action: "地面から空へ向かう雷も存在します。"
  },
  {
    fact: "雲の上は常に晴れている。",
    action: "雲の上空に出ると太陽が見え、青空が広がっています。"
  },
  {
    fact: "砂漠にも雪が降ることがある。",
    action: "気温条件によっては雪が観測されることもあります。"
  },
  {
    fact: "海の一番深い場所は約1万メートル。",
    action: "マリアナ海溝と呼ばれる場所で、非常に高い水圧がかかります。"
  },
  {
    fact: "宇宙では時間の進み方が変わる。",
    action: "相対性理論により、重力や速度で時間の流れが変化します。"
  },
  {
    fact: "地球は完全な球ではない。",
    action: "赤道部分が少し膨らんだ楕円形に近い形をしています。"
  },
  {
    fact: "太陽は白色に近い光を出している。",
    action: "地球の大気の影響で黄色っぽく見えています。"
  },
  {
    fact: "火山のマグマは場所によって性質が違う。",
    action: "粘り気や温度が異なり、噴火の仕方にも影響します。"
  },
  {
    fact: "氷山の大部分は水面下にある。",
    action: "見えている部分は全体の1割ほどしかありません。"
  },

  {
    fact: "ポップコーンは内部の水分で弾ける。",
    action: "加熱されて圧力が高まり、一気に破裂します。"
  },
  {
    fact: "卵は水に入れると鮮度がわかる。",
    action: "新しい卵は沈み、古い卵は浮きやすくなります。"
  },
  {
    fact: "チーズはカビを利用して作られるものもある。",
    action: "ブルーチーズなどは特定のカビによって独特の風味が生まれます。"
  },
  {
    fact: "パンは発酵によって膨らむ。",
    action: "イースト菌がガスを発生させることでふわっとした食感になります。"
  },
  {
    fact: "塩水は普通の水より重い。",
    action: "そのため物が浮きやすくなります。"
  },
  {
    fact: "冷たい水よりぬるい水の方が喉に優しい。",
    action: "体への負担が少なく、水分補給に適しています。"
  },
  {
    fact: "ガムを噛むと集中力が上がることがある。",
    action: "リズム運動によって脳が活性化されるとされています。"
  },
  {
    fact: "砂糖は加熱するとカラメルになる。",
    action: "温度によって色や味が変化します。"
  },
  {
    fact: "レモンは酸っぱいが体内ではアルカリ性に働く。",
    action: "代謝後の影響で体に与える効果が変わります。"
  },
  {
    fact: "牛乳は温めると甘く感じやすくなる。",
    action: "温度によって味の感じ方が変わります。"
  },

  {
    fact: "ハサミはてこの原理で動いている。",
    action: "小さな力で大きな力を生み出す仕組みです。"
  },
  {
    fact: "自転車は走ることで安定する。",
    action: "動いている方がバランスが取りやすい構造です。"
  },
  {
    fact: "鏡に映る像は左右ではなく前後が逆。",
    action: "人間の認識によって左右が逆に感じます。"
  },
  {
    fact: "電気は目に見えないがエネルギーとして存在する。",
    action: "日常のあらゆる機器がこの見えない力で動いています。"
  },
  {
    fact: "磁石は鉄など特定の金属に反応する。",
    action: "すべての金属がくっつくわけではありません。"
  },
  {
    fact: "空気にも重さがある。",
    action: "普段は感じませんが、圧力として影響を与えています。"
  },
  {
    fact: "風は気圧の差で生まれる。",
    action: "空気の移動によって風が発生します。"
  },
  {
    fact: "電球は電気を光と熱に変える。",
    action: "エネルギー変換の一例です。"
  },
  {
    fact: "影の長さは時間で変わる。",
    action: "太陽の位置によって変化します。"
  },
  {
    fact: "音は振動で伝わる。",
    action: "空気や水などの媒質が必要です。"
  },
] as const;

const ENCOURAGEMENT_SEEDS = [
  {
    line: "完璧じゃなくても、前に進んでいることが大事です。",
    action: "人は完成度より継続によって成長します。今日は「ここまでできた」でOKにして、止まらないことを優先しましょう。続けること自体が、あなたの力になります。"
  },
  {
    line: "今の一歩が、未来の自分を助けます。",
    action: "未来の自分は、今の積み重ねでできています。5分でもいいので、未来の自分が「やってくれてありがとう」と思える行動を選んでみましょう。"
  },
  {
    line: "小さく始める人が、最後まで続きます。",
    action: "最初から大きな成果を狙うと疲れます。まずは「簡単すぎるくらい」のハードルに下げて、確実に1歩進めることを意識してみましょう。"
  },
  {
    line: "やる気は、行動のあとについてきます。",
    action: "やる気を待つより、まず動く方が早いです。1分だけ手をつけてみると、不思議と続けられることが多いので、まずは最初の一手だけやってみましょう。"
  },
  {
    line: "止まらなければ、必ず前に進みます。",
    action: "大きな進歩でなくても大丈夫です。昨日と同じでも、少しでも続けていることが価値です。今日は「やめないこと」をゴールにしましょう。"
  },
  {
    line: "比較するなら、昨日の自分と比べましょう。",
    action: "他人と比べると疲れてしまいます。過去の自分と比べて、少しでもできたことを見つける方が、継続しやすくなります。"
  },
  {
    line: "できたことに目を向けると、次が楽になります。",
    action: "人はできなかったことばかり見がちです。でも、できたことに意識を向けると自信が生まれます。今日は「できたこと」を3つ書き出してみましょう。"
  },
  {
    line: "焦らなくていい、あなたのペースでいい。",
    action: "スピードよりも継続の方が重要です。他人のペースではなく、自分が無理なく続けられる速度で進むことを大切にしましょう。"
  },
  {
    line: "途中でやめなければ、それは失敗ではありません。",
    action: "うまくいかない日があっても、それは過程の一部です。やめなければ経験はすべて積み上がります。今日はもう一度だけ試してみましょう。"
  },
  {
    line: "1回の努力より、続ける力が大きな差を生みます。",
    action: "短期間の頑張りより、長く続けることの方が価値があります。今日も小さくてもいいので、継続の記録を積み上げましょう。"
  },
  {
    line: "少しでも進めば、それは前進です。",
    action: "完璧にできなくても問題ありません。「昨日よりほんの少しでも進んだか」を基準にして、自分を評価してみましょう。"
  },
  {
    line: "疲れたときは、休むことも戦略です。",
    action: "無理に続けるより、適切に休む方が結果的に効率が上がります。休む時間を決めて、その後に再開する計画を立てましょう。"
  },
  {
    line: "できる範囲で続けることが一番強いです。",
    action: "毎日100%を目指すと続きません。60%でも続けることの方が価値があります。今日は「無理しない範囲」で取り組みましょう。"
  },
  {
    line: "迷ったら、小さい方を選んで始めましょう。",
    action: "大きな決断は難しいですが、小さな行動ならすぐできます。まずは一番簡単なステップから始めてみましょう。"
  },
  {
    line: "積み重ねは、見えないところで効いています。",
    action: "すぐに成果が見えなくても、努力は確実に蓄積されています。今は見えなくても、後で大きな差になります。"
  },
  {
    line: "昨日より少しでも良ければ、それで十分です。",
    action: "完璧な成長ではなく、小さな改善を続けることが大切です。今日は1つだけ改善ポイントを意識してみましょう。"
  },
  {
    line: "続けることで、できることが増えていきます。",
    action: "最初は難しくても、繰り返すことで自然とできるようになります。今はできなくても、続けることで変わります。"
  },
  {
    line: "自分を責めるより、次に進む方が大事です。",
    action: "反省は必要ですが、引きずりすぎる必要はありません。次にどうするかを1つ決めて、行動に移しましょう。"
  },
  {
    line: "今日の一歩は、確実に未来につながっています。",
    action: "どんなに小さな行動でも、未来に影響します。今日の行動が未来の自分を作ることを意識してみましょう。"
  },
  {
    line: "やり続ける人が、最後に結果を出します。",
    action: "才能よりも継続が結果を分けます。今日も「やめないこと」を最優先にして、少しでも続けましょう。"
  },
    {
    line: "今日はちょっとしんどい日でもいいんです。",
    action: "毎日同じように頑張れる人はいません。しんどいと感じている時点で、あなたはちゃんと向き合っています。今日は無理に前に進もうとしなくても大丈夫です。"
  },
  {
    line: "何もしていないように見える日にも意味があります。",
    action: "休んでいる時間や考えている時間も、次に進むための準備です。見えないところでちゃんと積み上がっています。"
  },
  {
    line: "うまくいかない日があるのは普通です。",
    action: "順調な日ばかりではありません。むしろ、うまくいかない日があるからこそ、次にうまくいくヒントが見つかります。"
  },
  {
    line: "あなたはもう十分頑張っています。",
    action: "自分では足りないと感じていても、ここまで続けてきたこと自体がすごいことです。少し立ち止まって、その事実を認めてあげましょう。"
  },
  {
    line: "誰かと比べなくていいんです。",
    action: "人それぞれペースも状況も違います。あなたにはあなたの進み方があります。それだけで十分価値があります。"
  },
  {
    line: "うまくできなくても大丈夫です。",
    action: "できなかったことよりも、向き合ったことの方が大切です。挑戦している時点で前に進んでいます。"
  },
  {
    line: "今日はゆっくりでもいい日です。",
    action: "スピードが落ちる日があっても問題ありません。止まらずにいることの方がずっと大切です。"
  },
  {
    line: "不安になるのは自然なことです。",
    action: "何かに真剣に向き合っているからこそ不安になります。その気持ちはあなたがちゃんと考えている証拠です。"
  },
  {
    line: "今のままでも十分価値があります。",
    action: "まだ足りないと感じるかもしれませんが、今のあなたにもちゃんと価値があります。それは変わりません。"
  },
  {
    line: "頑張れない日があってもいいんです。",
    action: "ずっと頑張り続けることはできません。そんな日は、休むことも大事な選択です。"
  },

  {
    line: "少しずつでも進んでいます。",
    action: "自分では気づきにくいですが、積み重ねは確実にあります。過去の自分と比べてみると、その変化が見えてきます。"
  },
  {
    line: "あなたのペースで大丈夫です。",
    action: "速く進むことが正解ではありません。自分に合ったペースで続けることが、一番長く続く方法です。"
  },
  {
    line: "立ち止まることも前進です。",
    action: "一度止まって考えることで、次の一歩がより良いものになります。止まることも大切な時間です。"
  },
  {
    line: "今日はここまででも十分です。",
    action: "全部やりきらなくても大丈夫です。今日できた分を認めて、また明日につなげればそれで十分です。"
  },
  {
    line: "ちゃんと前に進んでいます。",
    action: "実感がなくても、行動している限り前に進んでいます。焦らなくて大丈夫です。"
  },
  {
    line: "続けていることがすごいことです。",
    action: "結果よりも、続けていることそのものに価値があります。その積み重ねが未来を作ります。"
  },
  {
    line: "無理しなくてもいいんです。",
    action: "無理をして続かなくなるよりも、少し力を抜いて続ける方が大切です。"
  },
  {
    line: "今日は自分に優しくしていい日です。",
    action: "厳しくするだけが成長ではありません。自分を労わることも、次に進む力になります。"
  },
  {
    line: "大丈夫、ちゃんとやれています。",
    action: "不安になることがあっても、ここまでやってきた自分を信じてあげてください。"
  },
  {
    line: "少し休んでも、また戻ってこれます。",
    action: "一度離れても大丈夫です。やめたわけではなく、少し距離を置いただけです。"
  },

  {
    line: "あなたの努力は無駄ではありません。",
    action: "すぐに結果が出なくても、必ずどこかで活きてきます。今は見えないだけです。"
  },
  {
    line: "できない日も含めて前進です。",
    action: "うまくいかない日も、全体で見れば成長の一部です。その日も意味があります。"
  },
  {
    line: "今の状態も大切な途中です。",
    action: "ゴールだけでなく、その途中にも価値があります。今の状態を否定しなくて大丈夫です。"
  },
  {
    line: "あなたは一人で頑張っています。",
    action: "誰かに見えなくても、その努力は確かに存在しています。そのこと自体がすごいです。"
  },
  {
    line: "焦らなくても、ちゃんと進めます。",
    action: "焦ると視野が狭くなります。少し落ち着いて、自分のペースに戻りましょう。"
  },
  {
    line: "今はまだ途中です。",
    action: "結果が出ていなくても、それはまだ途中だからです。続けていけば変わります。"
  },
  {
    line: "少しでもやれていることが大事です。",
    action: "完璧でなくても、ゼロでなければそれで十分です。その一歩に意味があります。"
  },
  {
    line: "そのままでも価値があります。",
    action: "何かを達成していなくても、あなた自身に価値があります。それは変わりません。"
  },
  {
    line: "ここまで来た自分を認めてあげてください。",
    action: "振り返ると、意外と進んでいることに気づきます。その事実をちゃんと受け止めてあげましょう。"
  },
  {
    line: "大丈夫、ちゃんと積み上がっています。",
    action: "目に見えなくても、確実に前に進んでいます。その積み重ねは裏切りません。"
  }
] as const;

function expandQuoteTemplates(): NotificationText[] {
  return QUOTE_SEEDS.map((seed) => ({
    shortText: `${seed.quote}（${seed.author}）`,
    description: "",
    actionSuggestion: seed.action,
  }));
}

function expandTriviaTemplates(): NotificationText[] {
  return TRIVIA_SEEDS.map((seed) => ({
    shortText: seed.fact,
    description: "",
    actionSuggestion: seed.action,
  }));
}

function expandEncouragementTemplates(): NotificationText[] {
  return ENCOURAGEMENT_SEEDS.map((seed) => ({
    shortText: seed.line,
    description: "",
    actionSuggestion: seed.action,
  }));
}

const QUOTE_TEMPLATES = expandQuoteTemplates();
const TRIVIA_TEMPLATES = expandTriviaTemplates();
const ENCOURAGEMENT_TEMPLATES = expandEncouragementTemplates();

const THEME_TEMPLATE_POOL: Record<SupportedTheme, NotificationText[]> = {
  名言: QUOTE_TEMPLATES,
  雑学: TRIVIA_TEMPLATES,
  励まし: ENCOURAGEMENT_TEMPLATES,
};

// 通知本文の生成ロジックです。
// 現在はMVP段階のため固定テンプレートを返します。
// 将来的にAI生成へ差し替える場合はこの関数を置換します。
function buildNotificationText(theme: string): NotificationText {
  const normalizedTheme = theme.trim();
  const pool = isSupportedTheme(normalizedTheme)
    ? THEME_TEMPLATE_POOL[normalizedTheme]
    : THEME_TEMPLATE_POOL["励まし"];

  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

// 通知を手動で1件生成して保存する処理です。
// 処理の流れ:
// 1. rule_id を検証
// 2. ruleが存在するか確認
// 3. 通知本文を生成
// 4. DBへ保存して返却
export async function generateNotificationService(
  input: GenerateNotificationInput,
): Promise<GenerateNotificationServiceResult> {
  // rule_id は必須かつ非空文字列である必要があります。
  if (!isNonEmptyString(input.rule_id)) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  // 前後空白を除去して正規化します。
  const ruleId = input.rule_id.trim();

  // 通知の元になるルールが存在するか確認します。
  // 存在しない場合は404相当のNOT_FOUNDを返します。
  const rule = await findRuleRecordById(ruleId);
  if (!rule) {
    return { ok: false, error: "NOT_FOUND" };
  }

  // ルールのテーマに応じて文面を作成します。
  const text = buildNotificationText(rule.theme);

  // 通知を保存します。
  // 手動生成APIなので scheduledDate は「生成した今の時刻」です。
  const created = await createNotificationRecord({
    ...(typeof rule.userId === "number" ? { userId: rule.userId } : {}),
    ruleId,
    scheduledDate: new Date(),
    shortText: text.shortText,
    description: text.description,
    actionSuggestion: text.actionSuggestion,
    isRead: false,
  });

  return {
    ok: true,
    data: created,
  };
}

// 後方互換用の簡易一覧取得です。
// 既存呼び出し向けに、デフォルト設定（1ページ目・20件）で返します。
export async function listNotificationsService(userId: number): Promise<NotificationRecord[]> {
  return listNotificationRecords({
    skip: 0,
    take: 20,
    userId,
  });
}

// クエリの boolean 値を解釈します。
// 戻り値の意味:
// - true/false: 正常
// - undefined: 未指定（フィルタなし）
// - null: 不正値（例: "yes", 123）
function parseBooleanQuery(value: unknown): boolean | undefined | null {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return null;
}

// 1以上の整数を解釈します。
// page/page_sizeのようなページング値に使います。
// - 未指定: defaultValue を返す
// - 不正: null を返す
function parsePositiveInt(value: unknown, defaultValue: number): number | null {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

// 通知一覧を「フィルタ + ページング」で取得する処理です。
// サポートするクエリ:
// - is_read: "true" | "false"
// - page: 1以上
// - page_size: 1以上
export async function listNotificationsWithQueryService(
  input: ListNotificationsInput,
): Promise<ListNotificationsServiceResult> {
  // 1) 既読フィルタを解釈します。
  const isRead = parseBooleanQuery(input.is_read);
  if (isRead === null) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  // 2) ページ番号と件数を解釈します。
  //    未指定なら page=1, page_size=20。
  const page = parsePositiveInt(input.page, 1);
  const pageSize = parsePositiveInt(input.page_size, 20);
  if (page === null || pageSize === null) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  // 3) page/page_size を skip/take へ変換して取得します。
  //    例: page=2, page_size=20 => skip=20, take=20
  const notifications = await listNotificationRecords({
    isRead: isRead,
    skip: (page - 1) * pageSize,
    take: pageSize,
    userId: input.userId,
  });

  return {
    ok: true,
    data: notifications,
  };
}

// 既読化APIの入力です。
// URLパラメータ id を unknown で受けて検証します。
export type MarkNotificationAsReadInput = {
  id?: unknown;
};

// 既読化APIの戻り値です。
// 存在しないIDに対しては NOT_FOUND を返せるようにします。
export type MarkNotificationAsReadServiceResult =
  | {
      ok: true;
      data: NotificationRecord;
    }
  | {
      ok: false;
      error: "INVALID_INPUT" | "NOT_FOUND";
    };

// 通知を既読にする処理です。
// 処理の流れ:
// 1. idを検証
// 2. 対象通知の存在確認
// 3. isRead=true へ更新
export async function markNotificationAsReadService(
  input: MarkNotificationAsReadInput,
): Promise<MarkNotificationAsReadServiceResult> {
  // idが空や不正な型なら入力不正です。
  if (!isNonEmptyString(input.id)) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  const notificationId = input.id.trim();

  // まず存在確認して、404を返せるようにします。
  const notification = await findNotificationRecordById(notificationId);
  if (!notification) {
    return { ok: false, error: "NOT_FOUND" };
  }

  // 存在している通知だけ既読に更新します。
  const updated = await markNotificationRecordAsRead(notificationId);
  return {
    ok: true,
    data: updated,
  };
}

// 全通知を削除する処理です。
// ユーザーIDがあればそのユーザー分、なければゲスト分を削除します。
export async function deleteAllNotificationsService(userId: number | undefined): Promise<number> {
  return deleteAllNotificationRecords(userId);
}
