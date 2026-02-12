export interface Achievement {
  key: string;
  meters: number;
  label: string;
  requirement: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { key: '77.7', meters: 77.7, label: '77.7m / いい感じのゾロ目', requirement: '77.7mに到達' },
  { key: '200', meters: 200, label: '200m / 観覧車よりちょい高いかも', requirement: '200mに到達' },
  { key: '333', meters: 333, label: '333m / 東京タワーのてっぺん', requirement: '333mに到達' },
  { key: '500', meters: 500, label: '500m / なんかもう十分高い', requirement: '500mに到達' },
  { key: '634', meters: 634, label: '634m / 東京スカイツリーのてっぺん', requirement: '634mに到達' },
  { key: '800', meters: 800, label: '800m / 雲に片足つっこんだ気分', requirement: '800mに到達' },
  { key: '1000', meters: 1000, label: '1000m / ついに1km', requirement: '1000mに到達' },
  { key: '1200', meters: 1200, label: '1200m / 深呼吸がちょっと怖い', requirement: '1200mに到達' },
  { key: '1337', meters: 1337, label: '1337m / 1337(LEET)って懐かしい', requirement: '1337mに到達' },
  { key: '1500', meters: 1500, label: '1500m / ここまで来ると意地', requirement: '1500mに到達' },
  { key: '1609.34', meters: 1609.34, label: '1609.34m / ちょうど1マイル', requirement: '1609.34mに到達' },
  { key: '1800', meters: 1800, label: '1800m / 地図の縮尺が変わる', requirement: '1800mに到達' },
  { key: '2025', meters: 2025, label: '2025m / 西暦2025年と同じ数字', requirement: '2025mに到達' },
  { key: '2200', meters: 2200, label: '2200m / だいたい山ひとつ分', requirement: '2200mに到達' },
  { key: '2600', meters: 2600, label: '2600m / そろそろ引き返す？', requirement: '2600mに到達' },
  { key: '2718.28', meters: 2718.28, label: '2718.28m / ネイピア数 e のにおい', requirement: '2718.28mに到達' },
  { key: '3000', meters: 3000, label: '3000m / 3kmおめでとう', requirement: '3000mに到達' },
  { key: '3141.59', meters: 3141.59, label: '3141.59m / 円周率っぽい高度', requirement: '3141.59mに到達' },
  { key: '3500', meters: 3500, label: '3500m / 空気が薄い気がする（気分）', requirement: '3500mに到達' },
  { key: '3776.12', meters: 3776.12, label: '3776.12m / 富士山の標高', requirement: '3776.12mに到達' },
  { key: '4000', meters: 4000, label: '4000m / スクロール職人見習い', requirement: '4000mに到達' },
  { key: '4444', meters: 4444, label: '4444m / 4が並ぶとちょっと強そう', requirement: '4444mに到達' },
  { key: '4600', meters: 4600, label: '4600m / ちょっとした遠征', requirement: '4600mに到達' },
  { key: '5300', meters: 5300, label: '5300m / いったん休憩する？', requirement: '5300mに到達' },
  { key: '5778', meters: 5778, label: '5778m / 太陽表面温度(K)らしい', requirement: '5778mに到達' },
  { key: '6100', meters: 6100, label: '6100m / 指が主役になってきた', requirement: '6100mに到達' },
  { key: '6371', meters: 6371, label: '6371m / 地球半径(km)と同じ数字', requirement: '6371mに到達' },
  { key: '7000', meters: 7000, label: '7000m / もう戻れない感じ', requirement: '7000mに到達' },
  { key: '8100', meters: 8100, label: '8100m / スクロール職人', requirement: '8100mに到達' },
  { key: '8848.86', meters: 8848.86, label: '8848.86m / エベレストの標高', requirement: '8848.86mに到達' },
  { key: '9300', meters: 9300, label: '9300m / 1万mが見えてきた', requirement: '9300mに到達' },
  { key: '10000', meters: 10000, label: '10000m / 10km通過。暇人の境地？', requirement: '10000mに到達' },
];

for (let index = 1; index < ACHIEVEMENTS.length; index += 1) {
  const prev = ACHIEVEMENTS[index - 1];
  const current = ACHIEVEMENTS[index];
  if (current.meters - prev.meters < 100) {
    throw new Error(
      `Achievement spacing rule violated: "${prev.key}" and "${current.key}" must be 100m apart.`
    );
  }
}
