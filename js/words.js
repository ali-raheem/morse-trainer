// Practice material: common words, the abbreviations and Q-codes heard on the air, and
// callsigns. Callsigns are random, so any match with a real licensee is a coincidence.

export const WORDS = `THE OF AND TO IN IS YOU THAT IT HE WAS FOR ON ARE AS WITH HIS THEY AT BE THIS HAVE FROM
OR ONE HAD BY WORD BUT NOT WHAT ALL WERE WE WHEN YOUR CAN SAID THERE USE AN EACH WHICH SHE DO HOW THEIR IF
WILL UP OTHER ABOUT OUT MANY THEN THEM THESE SO SOME HER WOULD MAKE LIKE HIM INTO TIME HAS LOOK TWO MORE
WRITE GO SEE NUMBER NO WAY COULD PEOPLE MY THAN FIRST WATER BEEN CALL WHO OIL ITS NOW FIND LONG DOWN DAY
DID GET COME MADE MAY PART OVER NEW SOUND TAKE ONLY LITTLE WORK KNOW PLACE YEAR LIVE ME BACK GIVE MOST
VERY AFTER THING OUR JUST NAME GOOD SENTENCE MAN THINK SAY GREAT WHERE HELP THROUGH MUCH BEFORE LINE
RIGHT TOO MEAN OLD ANY SAME TELL BOY FOLLOW CAME WANT SHOW ALSO AROUND FORM THREE SMALL SET PUT END DOES
ANOTHER WELL LARGE MUST BIG EVEN SUCH BECAUSE TURN HERE WHY ASK WENT MEN READ NEED LAND DIFFERENT HOME
US MOVE TRY KIND HAND PICTURE AGAIN CHANGE OFF PLAY SPELL AIR AWAY ANIMAL HOUSE POINT PAGE LETTER MOTHER
ANSWER FOUND STUDY STILL LEARN SHOULD WORLD HIGH EVERY NEAR ADD FOOD BETWEEN OWN BELOW COUNTRY PLANT LAST
SCHOOL FATHER KEEP TREE NEVER START CITY EARTH EYE LIGHT THOUGHT HEAD UNDER STORY SAW LEFT FEW WHILE ALONG
MIGHT CLOSE SOMETHING SEEM NEXT HARD OPEN EXAMPLE BEGIN LIFE ALWAYS THOSE BOTH PAPER TOGETHER GOT GROUP
OFTEN RUN RADIO ANTENNA WIRE POWER SIGNAL BAND NIGHT MORNING WEATHER SUN RAIN WIND COLD WARM`.split(/\s+/);

// On-air abbreviations and Q-codes.
export const ABBREVIATIONS = ['CQ', 'DE', 'K', 'KN', 'R', 'RST', '5NN', '599', 'UR', 'TNX', 'TU', 'FB', 'OM', 'YL', 'XYL',
  'HR', 'WX', 'RIG', 'ANT', 'PWR', 'QTH', 'QRZ', 'QSL', 'QSO', 'QRM', 'QRN', 'QSB', 'QRP', 'QRO', 'QRS', 'QRQ', 'QRT',
  'QRV', 'QSY', 'QRL', 'NAME', 'OP', 'ES', 'GM', 'GA', 'GE', 'GN', 'HW', 'CPY', 'AGN', 'PSE', 'BK', 'CUL', '73', '88',
  'SK', 'TEST', 'DX', 'NR', 'ABT', 'WID', 'HPE', 'SRI', 'VY', 'GL', 'BCNU'];

const PREFIXES = ['G', 'M', 'GM', 'GW', 'EI', 'F', 'DL', 'DK', 'ON', 'PA', 'EA', 'I', 'IK', 'OE', 'HB9', 'SM', 'LA', 'OH',
  'OZ', 'SP', 'OK', 'HA', 'YO', 'LZ', 'UA', 'UR', 'K', 'W', 'N', 'AA', 'KB', 'VE', 'VA', 'XE', 'PY', 'LU', 'CE', 'ZS',
  'JA', 'JH', 'HL', 'BV', 'VK', 'ZL', 'VU', '4X', 'A6', '9M2', 'YB', 'DU', 'KH6', 'KL7', 'TF', 'CT', 'SV', 'TA'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function callsign(rng) {
  const prefix = rng.pick(PREFIXES);
  const digit = /\d$/.test(prefix) ? '' : String(rng.int(0, 9));
  const n = rng.weighted([[1, 0.15], [2, 0.45], [3, 0.4]]);
  let suffix = '';
  for (let i = 0; i < n; i++) suffix += LETTERS[rng.int(0, 25)];
  return prefix + digit + suffix;
}

// A short, plausible exchange.
export function exchange(rng) {
  const a = callsign(rng);
  const b = callsign(rng);
  const name = rng.pick(['BOB', 'ANN', 'JIM', 'SUE', 'TOM', 'KAY', 'RON', 'LIZ', 'DAN', 'MEG', 'ALI', 'JO', 'PAT', 'SAM']);
  const rst = rng.pick(['599', '579', '559', '449', '5NN']);
  const qth = rng.pick(['LONDON', 'PARIS', 'BERLIN', 'MADRID', 'ROME', 'OSLO', 'TOKYO', 'OHIO', 'TEXAS', 'SYDNEY', 'LEEDS', 'YORK', 'CORK', 'LYON']);
  return rng.pick([
    `CQ CQ DE ${a} ${a} K`,
    `${b} DE ${a} UR RST ${rst} ${rst} NAME ${name} ${name} BK`,
    `${a} DE ${b} TNX FER CALL QTH ${qth} ${qth} HW?`,
    `R TU ${name} RIG HR 100W ANT DIPOLE WX SUNNY`,
    `${b} DE ${a} TNX QSO 73 GL <SK>`,
  ]);
}
