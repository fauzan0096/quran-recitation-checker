// © 2026 F A FS — Bayyin (بيّن). All rights reserved. Copying, redistribution
// or modification without written permission is not permitted (see LICENSE).
// Daily content: 60 ayat (references only — the text comes from Tanzil),
// 30 short ahadith and 60 beloved sunnahs.
//
// Takhreej note: the 30 ahadith are well-known ones with Bukhari / Muslim /
// Tirmidhi / Nasa'i numbers. The 60 sunnahs carry collection-level references —
// one of them ("give gifts") pointed at Bayhaqi, whose chain is weak, and now
// cites the Bukhari narration instead (2585). A scholar should still read the
// whole list once before release.

/** [surah, aya] — text is read from the bundled Tanzil mushaf, never retyped. */
export const AYAT = [
  [1, 1],
  [1, 5],
  [2, 152],
  [2, 186],
  [2, 255],
  [2, 286],
  [3, 8],
  [3, 139],
  [3, 159],
  [3, 190],
  [4, 36],
  [4, 58],
  [4, 86],
  [5, 8],
  [6, 162],
  [7, 55],
  [7, 56],
  [7, 204],
  [8, 46],
  [9, 51],
  [10, 57],
  [11, 114],
  [12, 87],
  [13, 11],
  [13, 28],
  [14, 7],
  [16, 90],
  [16, 97],
  [17, 23],
  [17, 80],
  [18, 46],
  [20, 114],
  [21, 107],
  [23, 1],
  [24, 35],
  [25, 63],
  [28, 77],
  [29, 45],
  [30, 21],
  [31, 17],
  [33, 41],
  [33, 56],
  [35, 29],
  [39, 53],
  [40, 60],
  [41, 34],
  [42, 43],
  [49, 10],
  [49, 13],
  [51, 56],
  [55, 13],
  [57, 28],
  [59, 22],
  [62, 9],
  [63, 9],
  [64, 11],
  [65, 3],
  [67, 2],
  [73, 8],
  [94, 5],
  [103, 3],
];

export const AHADITH = [
  {
    ar: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    rm: 'Ammal ka daar-o-madaar niyat par hai, aur har shakhs ko wohi milega jis ki us ne niyat ki.',
    en: 'Actions are judged by intentions, and each person will have what he intended.',
    ref: 'Bukhari 1 · Muslim 1907',
  },
  {
    ar: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَاليَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
    rm: 'Jo Allah aur aakhirat par iman rakhta hai, woh bhali baat kahe ya khamosh rahe.',
    en: 'Whoever believes in Allah and the Last Day, let him say what is good or stay silent.',
    ref: 'Bukhari 6018 · Muslim 47',
  },
  {
    ar: 'خَيْرُكُمْ مَنْ تَعَلَّمَ القُرْآنَ وَعَلَّمَهُ',
    rm: 'Tum me behtar woh hai jo Quran seekhe aur doosron ko sikhaye.',
    en: 'The best of you is the one who learns the Quran and teaches it.',
    ref: 'Bukhari 5027',
  },
  {
    ar: 'الدِّينُ النَّصِيحَةُ',
    rm: 'Deen naseehat ka naam hai — Allah, us ke Rasool, us ki kitab aur momino ke liye khair khwahi.',
    en: 'Religion is sincere advice — for Allah, His Messenger, His Book and the believers.',
    ref: 'Muslim 55',
  },
  {
    ar: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    rm: 'Tum me se koi us waqt tak mukammal momin nahi hota jab tak apne bhai ke liye wohi na chahe jo apne liye chahta hai.',
    en: 'None of you truly believes until he loves for his brother what he loves for himself.',
    ref: 'Bukhari 13 · Muslim 45',
  },
  {
    ar: 'مَنْ لَا يَرْحَمُ لَا يُرْحَمُ',
    rm: 'Jo reham nahi karta, us par reham nahi kiya jata.',
    en: 'Whoever shows no mercy will not be shown mercy.',
    ref: 'Bukhari 5997 · Muslim 2318',
  },
  {
    ar: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ صَدَقَةٌ',
    rm: 'Apne bhai ke samne muskurana bhi sadqa hai.',
    en: 'Your smile in your brother\u2019s face is charity.',
    ref: 'Tirmidhi 1956',
  },
  {
    ar: 'الطُّهُورُ شَطْرُ الإِيمَانِ',
    rm: 'Paki (taharat) iman ka aadha hissa hai.',
    en: 'Cleanliness is half of faith.',
    ref: 'Muslim 223',
  },
  {
    ar: 'المُسْلِمُ مَنْ سَلِمَ المُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ',
    rm: 'Muslim woh hai jis ki zaban aur haath se doosre Musalman mehfooz rahein.',
    en: 'A Muslim is the one from whose tongue and hand other Muslims are safe.',
    ref: 'Bukhari 10 · Muslim 40',
  },
  {
    ar: 'لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الغَضَبِ',
    rm: 'Asal taqatwar woh nahi jo kushti me ghaalib aa jaye; asal taqatwar woh hai jo ghusse ke waqt apne aap par qabu rakhe.',
    en: 'The strong one is not the wrestler; the strong one controls himself when angry.',
    ref: 'Bukhari 6114 · Muslim 2609',
  },
  {
    ar: 'اتَّقُوا النَّارَ وَلَوْ بِشِقِّ تَمْرَةٍ',
    rm: 'Aag se bacho, chahe ek khajoor ke tukre (sadqa) de kar.',
    en: 'Protect yourselves from the Fire, even with half a date given in charity.',
    ref: 'Bukhari 1417 · Muslim 1016',
  },
  {
    ar: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الجَنَّةِ',
    rm: 'Jo ilm ki talash me kisi raaste par chale, Allah us ke liye Jannat ka raasta asaan kar deta hai.',
    en: 'Whoever walks a path seeking knowledge, Allah makes easy for him a path to Paradise.',
    ref: 'Muslim 2699',
  },
  {
    ar: 'مَا نَقَصَتْ صَدَقَةٌ مِنْ مَالٍ',
    rm: 'Sadqa maal me kami nahi karta.',
    en: 'Charity does not decrease wealth.',
    ref: 'Muslim 2588',
  },
  {
    ar: 'أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
    rm: 'Allah ko sab se pasandeeda amal woh hai jo hamesha hota rahe, chahe thora ho.',
    en: 'The deeds most beloved to Allah are those done consistently, even if small.',
    ref: 'Bukhari 6464 · Muslim 783',
  },
  {
    ar: 'يَسِّرُوا وَلَا تُعَسِّرُوا، وَبَشِّرُوا وَلَا تُنَفِّرُوا',
    rm: 'Aasani karo, mushkil na karo; khush-khabri do, nafrat na dilaao.',
    en: 'Make things easy, do not make them hard; give glad tidings, do not repel people.',
    ref: 'Bukhari 6125 · Muslim 1734',
  },
  {
    ar: 'مَنْ كَانَ فِي حَاجَةِ أَخِيهِ كَانَ اللَّهُ فِي حَاجَتِهِ',
    rm: 'Jo apne bhai ki hajat me laga rahe, Allah us ki hajat me hota hai.',
    en: 'Whoever is engaged in his brother\u2019s need, Allah is engaged in his need.',
    ref: 'Bukhari 2442 · Muslim 2580',
  },
  {
    ar: 'مَنْ قَرَأَ حَرْفًا مِنْ كِتَابِ اللَّهِ فَلَهُ بِهِ حَسَنَةٌ',
    rm: 'Quran ka har harf ek neki hai — aur ek neki das guna hoti hai.',
    en: 'For every letter of the Book of Allah there is a reward, and a reward is multiplied tenfold.',
    ref: 'Tirmidhi 2910',
  },
  {
    ar: 'كَلِمَتَانِ خَفِيفَتَانِ عَلَى اللِّسَانِ، ثَقِيلَتَانِ فِي المِيزَانِ: سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ العَظِيمِ',
    rm: 'Do kalime zaban par halke, meezan me bhaari: SubhanAllahi wa bihamdihi, SubhanAllahil Azeem.',
    en: 'Two phrases light on the tongue but heavy on the scales: Glory be to Allah, and Allah the Great.',
    ref: 'Bukhari 6406 · Muslim 2694',
  },
  {
    ar: 'مَنْ صَلَّى الصُّبْحَ فَهُوَ فِي ذِمَّةِ اللَّهِ',
    rm: 'Jo Fajr padh le, woh Allah ki amaan me hai.',
    en: 'Whoever prays the morning prayer is under the protection of Allah.',
    ref: 'Muslim 657',
  },
  {
    ar: 'رَكْعَتَا الفَجْرِ خَيْرٌ مِنَ الدُّنْيَا وَمَا فِيهَا',
    rm: 'Fajr ki do sunnat duniya aur jo us me hai us se behtar hain.',
    en: 'The two rak\u2019ah before Fajr are better than the world and all it contains.',
    ref: 'Muslim 725',
  },
  {
    ar: 'مَنْ صَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ',
    rm: 'Jo Ramzan ke rozay iman aur sawab ki umeed se rakhe, us ke pichle gunah maaf ho jate hain.',
    en: 'Whoever fasts Ramadan out of faith and hope of reward, his previous sins are forgiven.',
    ref: 'Bukhari 38 · Muslim 760',
  },
  {
    ar: 'مَنْ قَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ',
    rm: 'Jo Ramzan ki raatein iman aur umeed se qayam kare, us ke pichle gunah maaf ho jate hain.',
    en: 'Whoever stands in prayer during Ramadan out of faith, his previous sins are forgiven.',
    ref: 'Bukhari 37 · Muslim 759',
  },
  {
    ar: 'مَنْ صَلَّى العِشَاءَ فِي جَمَاعَةٍ فَكَأَنَّمَا قَامَ نِصْفَ اللَّيْلِ',
    rm: 'Jo Isha jamaat se padhe, jaise us ne aadhi raat qayam ki.',
    en: 'Whoever prays Isha in congregation is as if he prayed half the night.',
    ref: 'Muslim 656',
  },
  {
    ar: 'مَنْ يُرِدِ اللَّهُ بِهِ خَيْرًا يُفَقِّهْهُ فِي الدِّينِ',
    rm: 'Allah jis ke sath khair chahta hai, usay deen ki samajh ata farmata hai.',
    en: 'Whomever Allah wishes good for, He gives him understanding of the religion.',
    ref: 'Bukhari 71 · Muslim 1037',
  },
  {
    ar: 'المُؤْمِنُ لِلْمُؤْمِنِ كَالبُنْيَانِ يَشُدُّ بَعْضُهُ بَعْضًا',
    rm: 'Momineen aapas me ek imarat ki tarah hain — ek doosre ko mazboot karte hain.',
    en: 'The believers are like a building, each part strengthening the other.',
    ref: 'Bukhari 481 · Muslim 2585',
  },
  {
    ar: 'مَنْ صَلَّى عَلَيَّ صَلَاةً صَلَّى اللَّهُ عَلَيْهِ بِهَا عَشْرًا',
    rm: 'Jo mujh par ek durood bheje, Allah us par das rehmatein bhejta hai.',
    en: 'Whoever sends one blessing upon me, Allah sends ten blessings upon him.',
    ref: 'Muslim 408',
  },
  {
    ar: 'مَنْ فَطَّرَ صَائِمًا كَانَ لَهُ مِثْلُ أَجْرِهِ',
    rm: 'Jo kisi rozedar ko iftar karaye, usay bhi utna hi sawab milta hai.',
    en: 'Whoever gives iftar to a fasting person has a reward like his.',
    ref: 'Tirmidhi 807',
  },
  {
    ar: 'أَفْضَلُ الذِّكْرِ لَا إِلَهَ إِلَّا اللَّهُ، وَأَفْضَلُ الدُّعَاءِ الحَمْدُ لِلَّهِ',
    rm: 'Behtareen zikr "La ilaha illallah" hai, aur behtareen du\u2019a "Alhamdulillah".',
    en: 'The best remembrance is "La ilaha illallah", and the best supplication is "Alhamdulillah".',
    ref: 'Tirmidhi 3383',
  },
  {
    ar: 'مَنْ دَعَا إِلَى هُدًى كَانَ لَهُ مِنَ الأَجْرِ مِثْلُ أُجُورِ مَنْ تَبِعَهُ',
    rm: 'Jo hidayat ki taraf bulaye, usay bhi utna hi sawab milta hai jitna maan-ne walon ko.',
    en: 'Whoever invites to guidance gets a reward like the rewards of those who follow him.',
    ref: 'Muslim 2674',
  },
  {
    ar: 'خَيْرُ الصَّدَقَةِ مَا كَانَ عَنْ ظَهْرِ غِنًى',
    rm: 'Behtareen sadqa woh hai jo apni zaroorat poora karke, baaqi maal se diya jaye.',
    en: 'The best charity is what is given out of wealth that you can spare.',
    ref: 'Bukhari 1429',
  },
];

export const SUNNAHS = [
  { rm: 'Miswak karna — nabi ﷺ khud karte aur ummat ko talqeen farmate.', en: 'Use the miswak.', ref: 'Bukhari 887' },
  { rm: 'Khane se pehle "Bismillah" kehna.', en: 'Say Bismillah before eating.', ref: 'Bukhari 5376' },
  { rm: 'Dayen haath se khana aur peena.', en: 'Eat and drink with the right hand.', ref: 'Bukhari 5376' },
  { rm: 'Khane ke baad "Alhamdulillah" kehna.', en: 'Say Alhamdulillah after eating.', ref: 'Tirmidhi 1815' },
  { rm: 'Paani teen saans me peena.', en: 'Drink water in three breaths.', ref: 'Muslim 2028' },
  { rm: 'Baith kar paani peena.', en: 'Sit while drinking water.', ref: 'Muslim 2024' },
  { rm: 'Aapas me salaam karna aur phelana.', en: 'Spread the greeting of salam.', ref: 'Muslim 54' },
  { rm: 'Ghar me daakhil hote waqt salaam karna.', en: 'Greet when entering the home.', ref: 'Tirmidhi 2699' },
  { rm: 'Masjid me dayen pair se daakhil hona, baayen se nikalna.', en: 'Enter the masjid with the right foot, leave with the left.', ref: 'Tirmidhi 314' },
  { rm: 'Masjid me bethne se pehle do rak\u2019ah tahiyyatul masjid.', en: 'Pray two rak\u2019ah on entering the masjid.', ref: 'Bukhari 1163' },
  { rm: 'Joota pehnte waqt dayen, utarte waqt baayen.', en: 'Put on the right shoe first, remove the left first.', ref: 'Bukhari 5856' },
  { rm: 'Kapda pehnte waqt dayen taraf se shuru karna.', en: 'Start with the right side when dressing.', ref: 'Tirmidhi 1766' },
  { rm: 'Chheenk aaye to "Alhamdulillah", jawab me "Yarhamukallah".', en: 'Say Alhamdulillah on sneezing; answer with Yarhamukallah.', ref: 'Bukhari 6224' },
  { rm: 'Jamhai aaye to munh dhak lena.', en: 'Cover the mouth when yawning.', ref: 'Muslim 2995' },
  { rm: 'Sone se pehle wudu karna.', en: 'Perform wudu before sleeping.', ref: 'Bukhari 247' },
  { rm: 'Dayen karwat par sona.', en: 'Sleep on the right side.', ref: 'Bukhari 6314' },
  { rm: 'Neend se uth kar bistar teen martaba jhaadna.', en: 'Dust the bed three times after waking.', ref: 'Bukhari 6320' },
  { rm: 'Sone se pehle Ayat al-Kursi parhna.', en: 'Recite Ayat al-Kursi before sleeping.', ref: 'Bukhari 2311' },
  { rm: 'Sone se pehle teen Quls parh kar haathon par dam karna.', en: 'Recite the three Quls and blow over the hands before sleeping.', ref: 'Bukhari 5017' },
  { rm: 'Wudu ke baad shahadat ke kalime parhna.', en: 'Recite the shahadah after wudu.', ref: 'Muslim 234' },
  { rm: 'Wudu me kulli aur naak achhi tarah saaf karna.', en: 'Rinse the mouth and nose well in wudu.', ref: 'Bukhari 164' },
  { rm: 'Nakhun katna, moonch chhoti karna, darhi rakhna.', en: 'Trim the nails, trim the moustache, keep the beard.', ref: 'Bukhari 5889' },
  { rm: 'Jism ke ghair zaroori baal saaf karna (fitrah).', en: 'Remove the body hair that the fitrah asks for.', ref: 'Muslim 261' },
  { rm: 'Khushbu lagana.', en: 'Wear perfume.', ref: 'Bukhari 5538' },
  { rm: 'Baal me tel lagana aur kanghi karna.', en: 'Oil and comb the hair.', ref: 'Tirmidhi 1852' },
  { rm: 'Safed kapde pehnna.', en: 'Wear white clothes.', ref: 'Tirmidhi 994' },
  { rm: 'Azan ke baad du\u2019a parhna.', en: 'Recite the du\u2019a after the adhan.', ref: 'Bukhari 614' },
  { rm: 'Namaz ke baad 33 tasbeeh, 33 tahmeed, 34 takbeer.', en: 'After prayer: 33 tasbeeh, 33 tahmeed, 34 takbeer.', ref: 'Muslim 596' },
  { rm: 'Farz namaz ke baad Ayat al-Kursi.', en: 'Recite Ayat al-Kursi after the obligatory prayer.', ref: 'Nasa\u2019i 992' },
  { rm: 'Witr parhna, chahe ek rak\u2019ah.', en: 'Pray witr, even one rak\u2019ah.', ref: 'Bukhari 990' },
  { rm: 'Duha ki namaz parhna.', en: 'Pray the duha prayer.', ref: 'Muslim 720' },
  { rm: 'Farz ke sath 12 rawatib sunnatein.', en: 'Keep the twelve sunnah rak\u2019ah around the obligatory prayers.', ref: 'Tirmidhi 415' },
  { rm: 'Raat ko tahajjud ke liye uthna.', en: 'Rise for tahajjud at night.', ref: 'Bukhari 1145' },
  { rm: 'Peer aur jumerat ke rozay.', en: 'Fast on Mondays and Thursdays.', ref: 'Muslim 1144' },
  { rm: 'Shaban me zyada rozay rakhna.', en: 'Fast more in Shaban.', ref: 'Muslim 1156' },
  { rm: 'Sahri khana, chahe thora sa.', en: 'Eat suhoor, even a little.', ref: 'Bukhari 1923' },
  { rm: 'Iftar me jaldi karna.', en: 'Break the fast promptly.', ref: 'Bukhari 1957' },
  { rm: 'Roza rakhne wale ko iftar karana.', en: 'Feed a fasting person at iftar.', ref: 'Tirmidhi 807' },
  { rm: 'Safar me du\u2019a parhna aur qasr karna.', en: 'Recite the travel du\u2019a and shorten the prayer.', ref: 'Muslim 1342' },
  { rm: 'Sawari par beth kar Bismillah aur takbeer.', en: 'Say Bismillah and takbeer when mounting a ride.', ref: 'Muslim 1342' },
  { rm: 'Mareez ki iyadat karna.', en: 'Visit the sick.', ref: 'Bukhari 1240' },
  { rm: 'Janaze ke sath chalna.', en: 'Follow the funeral.', ref: 'Bukhari 1315' },
  { rm: 'Musafaha (haath milana) karna.', en: 'Shake hands.', ref: 'Tirmidhi 2727' },
  { rm: 'Mehmaan ki izzat karna.', en: 'Honour the guest.', ref: 'Muslim 47' },
  { rm: 'Hadiya dena aur qabool karna.', en: 'Give gifts and accept them.', ref: 'Bukhari 2585' },
  { rm: 'Rishtedari jodna.', en: 'Keep the ties of kinship.', ref: 'Bukhari 5985' },
  { rm: 'Walidain ki khidmat karna.', en: 'Serve your parents.', ref: 'Bukhari 5971' },
  { rm: 'Yateem ki dekh-bhal karna.', en: 'Care for the orphan.', ref: 'Bukhari 5304' },
  { rm: 'Kisi ko khana khilana aur salaam karna.', en: 'Feed people and greet them.', ref: 'Bukhari 5273' },
  { rm: 'Pyaase ko — janwar ko bhi — paani pilana.', en: 'Give water to the thirsty, even an animal.', ref: 'Bukhari 2466' },
  { rm: 'Darakht lagana ya kheti karna.', en: 'Plant a tree or sow a crop.', ref: 'Bukhari 2320' },
  { rm: 'Apne bhai ke samne muskurana.', en: 'Smile at your brother.', ref: 'Tirmidhi 1956' },
  { rm: 'Parosi ka haq ada karna.', en: 'Fulfil the rights of the neighbour.', ref: 'Bukhari 6014' },
  { rm: 'Ghusse ke waqt khamosh ho jana.', en: 'Stay silent when angry.', ref: 'Bukhari 6114' },
  { rm: 'Maaf karna aur islaah karna.', en: 'Forgive and reconcile.', ref: 'Bukhari 6598' },
  { rm: 'Kalima-e-tayyibah ki kasrat karna.', en: 'Repeat the good word often.', ref: 'Muslim 2691' },
  { rm: 'Rozana Quran ki kuch ayaat parhna.', en: 'Recite some Quran every day.', ref: 'Tirmidhi 2910' },
  { rm: 'Durood shareef ki kasrat karna.', en: 'Send blessings on the Prophet often.', ref: 'Muslim 408' },
  { rm: 'Sote waqt "Bismika Allahumma amutu wa ahya".', en: 'Say the sleep dhikr when lying down.', ref: 'Bukhari 6324' },
  { rm: 'Har kaam ki shuruaat Bismillah se karna.', en: 'Begin every good act with Bismillah.', ref: 'Bukhari 5376' },
];


/**
 * Aasan matlab of each daily aya — a simple meaning, not an authorised
 * translation. Keyed as "surah:aya".
 */
export const AYAT_MEANING = {
  '1:1': {
    rm: 'Allah ke naam se jo nihayat meharban, nihayat reham wala hai.',
    en: 'In the name of Allah, the Most Merciful, the Most Compassionate.',
  },
  '1:5': {
    rm: 'Hum sirf teri ibadat karte hain aur sirf tujh hi se madad chahte hain.',
    en: 'You alone we worship, and You alone we ask for help.',
  },
  '2:152': {
    rm: 'Mujhe yaad karo, main tumhein yaad rakhunga; mera shukr karo aur na-shukri na karo.',
    en: 'Remember Me and I will remember you; be grateful and do not deny Me.',
  },
  '2:186': {
    rm: 'Jab mere bande mere bare me poochein, to main qareeb hoon; pukarnewale ki pukar ka jawab deta hoon.',
    en: 'When My servants ask about Me — I am near; I answer the call of the caller.',
  },
  '2:255': {
    rm: 'Allah hi zinda hai, sab ko thamne wala; na use neend aati hai na oongh — us ki kursi aasmanon aur zameen ko ghere hue hai.',
    en: 'Allah — the Ever-Living, the Sustainer; neither slumber nor sleep overtakes Him, and His Throne encompasses the heavens and the earth.',
  },
  '2:286': {
    rm: 'Allah kisi jaan par us ki taaqat se barh kar bojh nahi dalta.',
    en: 'Allah does not burden a soul beyond what it can bear.',
  },
  '3:8': {
    rm: 'Ae hamare Rab! hidayat ke baad hamare dilon ko tedha na kar, aur apni taraf se rehmat ata farma.',
    en: 'Our Lord, do not let our hearts deviate after You guided us, and grant us mercy from Yourself.',
  },
  '3:139': {
    rm: 'Himmat na haaro aur gham na karo; tum hi ghalib rahoge agar momin ho.',
    en: 'Do not lose hope and do not grieve; you will prevail if you are believers.',
  },
  '3:159': {
    rm: 'Allah par bharosa rakho; beshak Allah bharose rakhne walon ko pasand karta hai.',
    en: 'Place your trust in Allah; indeed Allah loves those who trust.',
  },
  '3:190': {
    rm: 'Aasmanon aur zameen ki pedaish aur din-raat ke aane-jane me aql wale logon ke liye nishaniyan hain.',
    en: 'In the creation of the heavens and the earth, and the alternation of night and day, are signs for people of understanding.',
  },
  '4:36': {
    rm: 'Allah ki ibadat karo aur us ke sath kisi ko shareek na karo; walidain ke sath ehsan karo.',
    en: 'Worship Allah and associate nothing with Him, and be good to your parents.',
  },
  '4:58': {
    rm: 'Amanatein un ke haqdar logon ko do, aur jab faisla karo to insaf se karo.',
    en: 'Return the trusts to their owners, and when you judge, judge with justice.',
  },
  '4:86': {
    rm: 'Jab koi salam kahe to us se behtar jawab do ya wohi wapas do.',
    en: 'When you are greeted, reply with a better greeting or return the same.',
  },
  '5:8': {
    rm: 'Insaf par qaim raho aur Allah ke liye sachi gawahi do; kisi ki dushmani tumhein insaf se na roke.',
    en: 'Stand firm for justice and bear true witness for Allah; let not hatred keep you from being just.',
  },
  '6:162': {
    rm: 'Meri namaz, meri qurbani, meri zindagi aur meri maut sab Allah ke liye hai.',
    en: 'My prayer, my sacrifice, my living and my dying are for Allah.',
  },
  '7:55': {
    rm: 'Apne Rab ko aajizi se aur chupke se pukaro; woh hadd se barhne walon ko pasand nahi karta.',
    en: 'Call upon your Lord humbly and quietly; He does not like those who overstep.',
  },
  '7:56': {
    rm: 'Zameen me fasad na phailao is ki durusti ke baad.',
    en: 'Do not spread corruption on the earth after it has been set right.',
  },
  '7:204': {
    rm: 'Jab Quran padha jaye to khamosh ho kar ghaur se suno taake tum par reham kiya jaye.',
    en: 'When the Quran is recited, listen to it attentively so that you may receive mercy.',
  },
  '8:46': {
    rm: 'Allah aur us ke Rasool ki itaat karo aur apas me jhagda na karo, warna kamzor pad jaaoge.',
    en: 'Obey Allah and His Messenger, and do not dispute, or you will lose strength.',
  },
  '9:51': {
    rm: 'Hum par wohi aayega jo Allah ne hamare liye likh diya hai; wohi hamara madadgar hai.',
    en: 'Nothing will befall us except what Allah has decreed for us; He is our Protector.',
  },
  '10:57': {
    rm: 'Logon! tumhare Rab ki taraf se tumhare paas naseehat aur dilon ki shifa aa chuki hai.',
    en: 'O mankind, there has come to you an admonition from your Lord, and healing for the hearts.',
  },
  '11:114': {
    rm: 'Neki ki baatein buraiyon ko mita deti hain.',
    en: 'Good deeds remove bad deeds.',
  },
  '12:87': {
    rm: 'Allah ki rehmat se mayoos na ho; beshak kafir log hi mayoos hote hain.',
    en: 'Do not despair of Allah\u2019s mercy; only the disbelieving people despair.',
  },
  '13:11': {
    rm: 'Allah kisi qaum ki halat nahi badalta jab tak woh khud apni halat na badle.',
    en: 'Allah does not change a people\u2019s condition until they change what is in themselves.',
  },
  '13:28': {
    rm: 'Yaad rakho, dilon ko sukoon Allah ke zikr hi se milta hai.',
    en: 'Surely, hearts find rest in the remembrance of Allah.',
  },
  '14:7': {
    rm: 'Agar tum shukr karoge to main tumhein aur zyada dunga.',
    en: 'If you are grateful, I will surely increase you.',
  },
  '16:90': {
    rm: 'Allah insaf, ehsan aur rishtedaron ko dene ka hukm deta hai, aur be-hayai se rokta hai.',
    en: 'Allah orders justice, good conduct and giving to relatives, and forbids indecency.',
  },
  '16:97': {
    rm: 'Jo neek amal kare — mard ho ya aurat — magar momin ho, hum use paak zindagi denge.',
    en: 'Whoever does good, male or female, and is a believer, We will give them a good life.',
  },
  '17:23': {
    rm: 'Walidain ke sath ehsan karo; un ke barhape me unhein "oof" bhi na kaho.',
    en: 'Be good to your parents; never say to them a word of contempt.',
  },
  '17:80': {
    rm: 'Ae mere Rab! mujhe sacha daakhla aur sacha nikalna ata farma aur apni taraf se madadgar bana.',
    en: 'My Lord, grant me a truthful entrance and a truthful exit, and give me support from Yourself.',
  },
  '18:46': {
    rm: 'Baqi rehne wale neek amal tere Rab ke paas sawab aur umeed ke lehaz se behtar hain.',
    en: 'Enduring good deeds are better in reward and better in hope.',
  },
  '20:114': {
    rm: 'Ae mere Rab! mere ilm me izafa farma.',
    en: 'My Lord, increase me in knowledge.',
  },
  '21:107': {
    rm: 'Hum ne aap ko tamam jahano ke liye rehmat bana kar bheja hai.',
    en: 'We have sent you only as a mercy to the worlds.',
  },
  '23:1': {
    rm: 'Kamyab ho gaye momin.',
    en: 'Successful indeed are the believers.',
  },
  '24:35': {
    rm: 'Allah aasmanon aur zameen ka noor hai.',
    en: 'Allah is the Light of the heavens and the earth.',
  },
  '25:63': {
    rm: 'Rehman ke bande zameen par aajizi se chalte hain.',
    en: 'The servants of the Most Merciful walk upon the earth humbly.',
  },
  '28:77': {
    rm: 'Allah ne tujhe jo diya us se akhirat ka ghar talaash kar, aur duniya me bhi hissa na bhool.',
    en: 'Seek the home of the Hereafter with what Allah has given you, and do not forget your share of this world.',
  },
  '29:45': {
    rm: 'Beshak namaz be-hayai aur burai se rokti hai.',
    en: 'Indeed, prayer restrains from indecency and wrongdoing.',
  },
  '30:21': {
    rm: 'Us ki nishaniyon me se hai ke tumhare liye tum hi me se jode banaye taake tum sukoon pao.',
    en: 'Among His signs is that He created for you mates from among yourselves, that you may find rest.',
  },
  '31:17': {
    rm: 'Namaz qaim kar, neki ka hukm de, burai se rok aur jo museebat aaye us par sabr kar.',
    en: 'Establish prayer, enjoin good, forbid evil, and be patient over what befalls you.',
  },
  '33:41': {
    rm: 'Ae iman walo! Allah ko kasrat se yaad karo.',
    en: 'O you who believe, remember Allah often.',
  },
  '33:56': {
    rm: 'Allah aur us ke farishte Nabi par durood bhejte hain; ae iman walo, tum bhi durood aur salam bhejo.',
    en: 'Allah and His angels send blessings on the Prophet; O believers, send blessings and peace upon him.',
  },
  '35:29': {
    rm: 'Jo Allah ki kitab padhte hain, namaz qaim karte hain aur apne rizq se khair kharch karte hain.',
    en: 'Those who recite the Book of Allah, establish prayer and spend from what We gave them.',
  },
  '39:53': {
    rm: 'Apne nafson par zulm karne walo! Allah ki rehmat se mayoos na ho; woh saare gunah maaf karta hai.',
    en: 'Do not despair of Allah\u2019s mercy, O you who have wronged yourselves; He forgives all sins.',
  },
  '40:60': {
    rm: 'Mujhe pukaro, main tumhari dua qubool karunga.',
    en: 'Call upon Me, and I will respond to you.',
  },
  '41:34': {
    rm: 'Bhalai aur burai barabar nahi hoti; burai ko bhalai se door karo.',
    en: 'Good and evil are not equal; repel evil with what is better.',
  },
  '42:43': {
    rm: 'Jo sabr kare aur maaf kar de, yeh badi himmat ka kaam hai.',
    en: 'Whoever is patient and forgives — that is a matter of true resolve.',
  },
  '49:10': {
    rm: 'Momineen to aapas me bhai bhai hain; apne bhaiyon ke darmiyan sulah karwao.',
    en: 'The believers are but brothers, so make peace between your brothers.',
  },
  '49:13': {
    rm: 'Allah ke paas tum me sab se zyada izzat woh hai jo sab se zyada parhezgar ho.',
    en: 'The most honoured among you before Allah is the most mindful of Him.',
  },
  '51:56': {
    rm: 'Maine jinn aur insan sirf isi liye paida kiye ke woh meri ibadat karein.',
    en: 'I created jinn and mankind only so that they would worship Me.',
  },
  '55:13': {
    rm: 'Pas tum apne Rab ki kaun si nemat jhutlaoge?',
    en: 'So which of the favours of your Lord will you deny?',
  },
  '57:28': {
    rm: 'Allah aur us ke Rasool par iman lao; woh tumhein apni rehmat se dohra hissa ata karega.',
    en: 'Believe in Allah and His Messenger, and He will give you a double share of His mercy.',
  },
  '59:22': {
    rm: 'Woh Allah hai jis ke siwa koi mabood nahi — gaib aur hazir ka janne wala, nihayat meharban, reham wala.',
    en: 'He is Allah, there is no god but He — Knower of the unseen and the seen, the Most Merciful.',
  },
  '62:9': {
    rm: 'Ae iman walo! jab Jumma ke din namaz ki pukar ho to Allah ke zikr ki taraf daudo.',
    en: 'O you who believe, when the call to prayer is given on Friday, hasten to remember Allah.',
  },
  '63:9': {
    rm: 'Ae iman walo! tumhare maal aur aulad tumhein Allah ke zikr se ghaflat me na daalein.',
    en: 'O you who believe, let not your wealth and children distract you from remembering Allah.',
  },
  '64:11': {
    rm: 'Koi museebat Allah ki ijazat ke baghair nahi aati; jo Allah par iman laye, us ka dil hidayat pa jata hai.',
    en: 'No calamity strikes except by Allah\u2019s permission; whoever believes, his heart is guided.',
  },
  '65:3': {
    rm: 'Jo Allah par bharosa kare, usay Allah kaafi hai.',
    en: 'Whoever puts his trust in Allah — He is sufficient for him.',
  },
  '67:2': {
    rm: 'Jis ne maut aur zindagi paida ki taake tumhein aazmaye ke kaun behtar amal karta hai.',
    en: 'He created death and life to test which of you is best in deeds.',
  },
  '73:8': {
    rm: 'Apne Rab ka naam yaad karo aur sab se kat kar sirf usi ki ibadat me lage raho.',
    en: 'Remember the name of your Lord and devote yourself to Him entirely.',
  },
  '94:5': {
    rm: 'Yaqeenan mushkil ke sath aasani hai.',
    en: 'Indeed, with hardship comes ease.',
  },
  '103:3': {
    rm: 'Siway un ke jo iman laye, neek amal kiye aur ek doosre ko haq aur sabr ki naseehat ki.',
    en: 'Except those who believe, do good, and advise one another to truth and patience.',
  },
};
