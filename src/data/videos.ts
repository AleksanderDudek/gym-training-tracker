import type { ExerciseId, ExerciseVideos } from '../types';

/**
 * Filmy instruktażowe dla każdego ćwiczenia z biblioteki, w dwóch listach:
 * `main` to najpopularniejsze nagrania techniki bez względu na sprzęt, `kb` to ten sam
 * ruch w wariancie z kettlebell — do tej drugiej listy wchodzą wyłącznie filmy, które
 * nazywają odważnik w tytule albo w nazwie kanału.
 *
 * Lista nie jest pisana z pamięci. Powstała z wyników wyszukiwania YouTube: kandydaci są
 * odsiewani po długości i tytule, oceniani liczbą wyświetleń wraz z pozycją w wynikach,
 * ograniczani do jednego filmu na kanał, a każdy identyfikator sprawdzono przez oEmbed
 * i stronę osadzania — odpadłyby filmy usunięte, prywatne i z wyłączonym osadzaniem.
 * Żaden film nie powtarza się między listami ani między ćwiczeniami. Aplikacja jest po
 * polsku, więc część miejsc rezerwowana jest na nagrania polskie.
 *
 * Wygenerowane 2026-09-02. Autorzy czasem usuwają filmy, dlatego
 * każda karta ma obok odtwarzacza zwykły link do YouTube — martwe osadzenie nie psuje strony.
 */
export const VIDEOS: Record<ExerciseId, ExerciseVideos> = {
  swing2: {
    main: [
      { id: 'sSESeQAir2M', title: "How To Do A Kettlebell Swing | The Right Way | Well+Good", channel: "Well+Good", lang: 'en', secs: 153 },
      { id: 'LBhaLLc153A', title: "The Kettlebell Swing Technique Everyone Gets WRONG!", channel: "Squat University", lang: 'en', secs: 232 },
      { id: 'DqkYuWR4zRI', title: "HOW TO DO A KETTLEBELL SWING WITHOUT HURTING YOUR BACK!", channel: "Dr. Dan's Plan", lang: 'en', secs: 169 },
      { id: 'zSww9F2ZEW8', title: "STOP DOING SH*TTY KETTLEBELL SWINGS", channel: "Kelly Matthews", lang: 'en', secs: 426 },
      { id: 'xOEVB9_rKfY', title: "POPRAWNA TECHNIKA SWINGU I BŁĘDY", channel: "ProFi Academy", lang: 'pl', secs: 220 },
    ],
    kb: [
      { id: 'YSxHifyI6s8', title: "Kettlebell Swing", channel: "Men's Health", lang: 'en', secs: 118 },
      { id: 'w68bAWT41FQ', title: "SWING - POPRAWNA TECHNIKA - KETTLEBELLS", channel: "ProFi Academy", lang: 'pl', secs: 269 },
      { id: 'n7PWyZl9q-w', title: "How Kettlebell Swings Completely Change Your Body", channel: "FitZip", lang: 'en', secs: 553 },
      { id: 'GUrnB2OGXFE', title: "Kettlebell Swing krok po kroku | Szkoła Kettlebell", channel: "Gotowy Na Trening | GNT", lang: 'pl', secs: 265 },
    ],
  },
  swing1: {
    main: [
      { id: 'BXrXhyudA80', title: "One Arm Kettlebell Swing by Pavel Tsatsouline", channel: "Strong And Fit", lang: 'en', secs: 130 },
      { id: '0L0cOOpyPpA', title: "One-Arm Swing Tutorial", channel: "Hardstyle Kettlebell Pro", lang: 'en', secs: 236 },
      { id: '5i_xp1vtkc4', title: "How To: Single-Arm Kettlebell Swing", channel: "Zack Henderson", lang: 'en', secs: 231 },
      { id: 'eMrqzxXO0WM', title: "Swing jednorącz czyli najważniejsze ćwiczenie z kettlami.", channel: "Squats - Swings - Other - Things", lang: 'pl', secs: 516 },
      { id: '7-0unAeFLL0', title: "TECHNIKA SWINGU JEDNORĄCZ - 5 prostych kroków! | *kettlebell*", channel: "Trenuj Wszechstronnie", lang: 'pl', secs: 420 },
    ],
    kb: [
      { id: 'yeMXdkZ18EA', title: "Simple & Sinister: A Tip for a Better Kettlebell Swing", channel: "StrongFirst.cz", lang: 'en', secs: 156 },
      { id: 'ktQO1vrLfsE', title: "Kettlebell Swing - One Arm - Hardstyle - Pat Flynn RKC", channel: "Pat Flynn", lang: 'en', secs: 58 },
      { id: 'C0t_w2HXQSg', title: "Karen Smith Master SFG - Hardstyle KB Swing", channel: "Karen Smith", lang: 'en', secs: 108 },
      { id: 'Twx0DYfcpRw', title: "Kettlebell Swing: Hardstyle vs Girevoy", channel: "Kat's Kettlebell Dojo", lang: 'en', secs: 525 },
    ],
  },
  rdl: {
    main: [
      { id: '_oyxCn2iSjU', title: "HOW TO DO ROMANIAN DEADLIFTS (RDLs): Build Beefy Hamstrings With Perfect Technique", channel: "Jeff Nippard", lang: 'en', secs: 382 },
      { id: '5zmlnbWb-g4', title: "Stop F*cking Up RDL's (PROPER FORM!)", channel: "ATHLEAN-X™", lang: 'en', secs: 351 },
      { id: 'hinonqqzatk', title: "How To Do a Kettlebell Deadlift | The Right Way | Well+Good", channel: "Well+Good", lang: 'en', secs: 132 },
      { id: 'KCb97iPJsC0', title: "RUMUŃSKI MARTWY CIĄG - TYPOWE BŁĘDY", channel: "ProFi Academy", lang: 'pl', secs: 329 },
      { id: 'LFSz_gdW-pw', title: "Rumuński Martwy Ciąg - PRAWIDŁOWA Technika (Przestań Popełniać Te Błędy)", channel: "Piotr 'Szmexy' Tomaszewski", lang: 'pl', secs: 486 },
    ],
    kb: [
      { id: 'Uc5rP5xs7qQ', title: "How to: Kettlebell Romanian Deadlift (RDL)", channel: "Of The Lion Fitness", lang: 'en', secs: 117 },
      { id: 'V6XTfsdX_V8', title: "Kettlebell Romanian Deadlift - Modern Woman's Guide to Strength Training", channel: "Girls Gone Strong | Women's Health & Fitness", lang: 'en', secs: 60 },
      { id: 'LDfnyt0Rmaw', title: "Kettlebell DEADLIFT", channel: "Hardstyle Kettlebell Pro", lang: 'en', secs: 337 },
      { id: '8oW8MP8rzCo', title: "Kettlebell HardStyle - odc. 3 - Martwy Ciąg", channel: "Wschodnia Siła", lang: 'pl', secs: 180 },
    ],
  },
  goblet: {
    main: [
      { id: '9W5KAqHfDe8', title: "The Goblet Squat Exercise Guide - The Proper Form, Sets & Routine Tutorial", channel: "Fit Father Project - Fitness For Busy Fathers", lang: 'en', secs: 208 },
      { id: 'gCESNsDsbqk', title: "Goblet Squats: Proper Form & Technique", channel: "BuiltLean®", lang: 'en', secs: 66 },
      { id: 'gcNh17Ckjgg', title: "How to PROPERLY Squat for Growth (4 Easy Steps)", channel: "Jeremy Ethier", lang: 'en', secs: 435 },
      { id: 'kPHqY59DYEQ', title: "GOBLET SQUAT- naucz się przysiadu w 4 minuty⏰", channel: "MADESIRE", lang: 'pl', secs: 242 },
      { id: 'fB39vO4dA9Y', title: "GOBLET SQUAT  - POPRAWA MOBILNOŚCI W PRZYSIADZIE", channel: "ProFi Academy", lang: 'pl', secs: 167 },
    ],
    kb: [
      { id: 'XGJvb8waI98', title: "How To PERFECT A Kettlebell Squat: Correct Form & Mistakes To Avoid | Masterclass | Myprotein", channel: "Myprotein", lang: 'en', secs: 240 },
      { id: 'QilYZ20kVfM', title: "How to Goblet Squat (with Kettlebell)", channel: "Coach Gabe West", lang: 'en', secs: 180 },
      { id: 'aNDUbH_Uv4g', title: "Kettlebell GOBLET SQUAT (Proper Form & Common Mistakes)", channel: "Zack Henderson", lang: 'en', secs: 620 },
      { id: 'G8MJiI6LcHk', title: "Kettlebell HardStyle - odc. 6 - Goblet Squat", channel: "Wschodnia Siła", lang: 'pl', secs: 166 },
    ],
  },
  lunge: {
    main: [
      { id: 'uImsgS-5P28', title: "Kettlebell Front Rack Lunge", channel: "PappasFit", lang: 'en', secs: 65 },
      { id: '73OwYFfga1g', title: "Front rack reverse lunge - Explode Your Leg Strength!", channel: "Performance Edge Crossfit", lang: 'en', secs: 110 },
      { id: 'VhTIWTgXk6g', title: "Double Kettlebell Front Rack Lunge", channel: "Headstrong Fit", lang: 'en', secs: 59 },
      { id: 'f5DTQ-w2J9c', title: "Front Rack Reverse Lunge", channel: "LOOK STRONG NAKED", lang: 'en', secs: 88 },
      { id: 'l22IIz-5tQw', title: "Kettlebell Front Rack Lunge", channel: "Dan Skidmore", lang: 'en', secs: 63 },
    ],
    kb: [
      { id: '2D4xApe-UFU', title: "How to Perform the Kettlebell Reverse Lunge | Huge Exercise for the Buttocks and Legs", channel: "Greg Brookes", lang: 'en', secs: 200 },
      { id: '_Aw3hQjCcRw', title: "Single Arm Kettlebell Reverse Lunge ♠ Best Butt Exercises", channel: "GymPaws", lang: 'en', secs: 55 },
      { id: '3ygYqMMoxbU', title: "Kettlebell Lunge Workout Tutorial - Top Leg Exercise", channel: "Fit Father Project - Fitness For Busy Fathers", lang: 'en', secs: 406 },
      { id: 'cEULS3mHWrE', title: "Ćwiczenia Kettlebell - Techniki wspomagające, wykroki", channel: "CROSSTREC", lang: 'pl', secs: 300 },
    ],
  },
  row: {
    main: [
      { id: 'roCP6wCXPqo', title: "How to Perfect Your Dumbbell Row | Form Check | Men's Health", channel: "Men's Health", lang: 'en', secs: 196 },
      { id: 'dFzUjzfih7k', title: "How to do the SINGLE ARM DUMBBELL ROW! | 2 Minute Tutorial", channel: "Max Euceda", lang: 'en', secs: 120 },
      { id: 'pYcpY20QaE8', title: "How To: Dumbbell Bent-Over Row (Single-Arm)", channel: "ScottHermanFitness", lang: 'en', secs: 140 },
      { id: '8hClc1TBMak', title: "Wiosłowanie hantlem jednorącz w podporze o ławkę", channel: "budujmase.pl", lang: 'pl', secs: 104 },
      { id: 'YAEBKTpH2lw', title: "Wiosłowanie hantlem - jak ćwiczyć żeby ROSNĄĆ?", channel: "Tomek Grzymski", lang: 'pl', secs: 384 },
    ],
    kb: [
      { id: 'j2OdaGOmHlM', title: "Kettlebell One-Arm Row Instruction", channel: "Breaking Muscle", lang: 'en', secs: 64 },
      { id: 'UsxcaALqr2c', title: "The Kettlebell Gorilla Row", channel: "Testosterone Nation", lang: 'en', secs: 79 },
      { id: 'bZ4h1Bqw-to', title: "Kettlebell Unsupported Single Arm Kb Row - Anti rotation rowing exercise", channel: "Mark Wildman", lang: 'en', secs: 430 },
      { id: 'giQ2olizsp8', title: "WIOSŁOWANIE ODWAŻNIKIEM KETTLEBELL", channel: "ProFi Academy", lang: 'pl', secs: 220 },
    ],
  },
  pullup: {
    main: [
      { id: 'eGo4IYlbE5g', title: "The Perfect Pull Up  - Do it right!", channel: "Calisthenicmovement", lang: 'en', secs: 272 },
      { id: 'bb8_5vZV5dU', title: "Go from 0 to 10 Pull-Ups FAST", channel: "Gravity Transformation - Fat Loss Experts", lang: 'en', secs: 735 },
      { id: 'fO3dKSQayfg', title: "You CAN do pullups, my friend!", channel: "Hybrid Calisthenics", lang: 'en', secs: 384 },
      { id: 'YYbqPzlwY6c', title: "JAK WIĘCEJ SIĘ PODCIĄGAĆ? *od 0 do 20 powtórzeń!*", channel: "Tomek Grzymski", lang: 'pl', secs: 428 },
      { id: 'UvW6XnClK7A', title: "PODCIĄGANIE - Prawidłowa Technika (KALISTENIKA)", channel: "KURA WORKOUT", lang: 'pl', secs: 131 },
    ],
    kb: [
    ],
  },
  curl: {
    main: [
      { id: 'jjnJHhzZUUM', title: "STOP Doing Bicep Curls Like This (5 Mistakes Slowing Your Gains)", channel: "Jeremy Ethier", lang: 'en', secs: 454 },
      { id: 'XE_pHwbst04', title: "Bicep Curls — (DUMBBELL FORM & TECHNIQUE)", channel: "Fit Father Project - Fitness For Busy Fathers", lang: 'en', secs: 159 },
      { id: 'ykJmrZ5v0Oo', title: "How to Do a Dumbbell Biceps Curl | Arm Workout", channel: "Howcast", lang: 'en', secs: 109 },
      { id: 'av7-8igSXTs', title: "How to Do Standing Dumbbell Curls", channel: "LIVESTRONG", lang: 'en', secs: 102 },
      { id: 'kdwwJSGrum0', title: "NIE POPEŁNIAJ TYCH BŁĘDÓW W TRENINGU BICEPSÓW!", channel: "Szymon Moszny", lang: 'pl', secs: 238 },
    ],
    kb: [
      { id: 'OfgQrQCLJsk', title: "How to Do a Bicep Curl With a Kettlebell", channel: "LIVESTRONG", lang: 'en', secs: 61 },
      { id: 'X5kMsh-Zdhc', title: "How to Do a Bicep Curl With a Kettlebell : Fitness Fanatics", channel: "eHowFitness", lang: 'en', secs: 89 },
      { id: 'OSqCDx0KVqM', title: "How To Curl With a Kettlebell | Biceps Curl Technique and Variations", channel: "Cavemantraining™", lang: 'en', secs: 764 },
      { id: 'TmnYLeYm6XA', title: "7 of the BEST Kettlebell Arm Curl Exercises to Build Stronger Biceps", channel: "Criticalbench", lang: 'en', secs: 346 },
    ],
  },
  press: {
    main: [
      { id: 'Tr31MZxZ5o0', title: "Kettlebell Overhead Press - How to Coach", channel: "Alloy Personal Training Franchise", lang: 'en', secs: 173 },
      { id: 'XHkI03S6Pls', title: "Kettlebell 14 - intro to the Single arm Kettlebell overhead press - essential athletic development", channel: "Mark Wildman", lang: 'en', secs: 336 },
      { id: 'WMb8U-V-6ek', title: "STOP Making This Overhead Press MISTAKE!", channel: "Lebe Stark", lang: 'en', secs: 426 },
      { id: 'ykyeHMRKQPU', title: "The SAFEST Way to Do a Kettlebell Press in 2 Minutes!", channel: "Coach Gabe West", lang: 'en', secs: 145 },
      { id: 'OSUT594ZLI4', title: "WYCISKANIE ŻOŁNIERSKIE ODWAŻNIKIEM KULOWYM - Podstawy kettlebells cz.10", channel: "Łukasz Śliwa", lang: 'pl', secs: 637 },
    ],
    kb: [
      { id: '78-gZ-y3vgA', title: "Kettlebell MILITARY PRESS (Ultimate Guide)", channel: "Zack Henderson", lang: 'en', secs: 1113 },
      { id: '3G_PcvN4wug', title: "Kettlebell HardStyle - odc. 7 - Military Press", channel: "Wschodnia Siła", lang: 'pl', secs: 195 },
      { id: 'iW-PGDQwmn8', title: "Kettlebell Military Press Tutorial", channel: "Mike Stehle", lang: 'en', secs: 94 },
      { id: 'zTz8EO6sJlg', title: "Set the Lat to Boost Your Kettlebell Military Press | StrongFirst", channel: "StrongFirst", lang: 'en', secs: 202 },
    ],
  },
  floor: {
    main: [
      { id: 'QsYre__-aro', title: "STOP Doing Dumbbell Press Like This (5 Mistakes Slowing Your Chest Gains)", channel: "Jeremy Ethier", lang: 'en', secs: 449 },
      { id: 'B340QckIfJM', title: "1 Arm Kettlebell Floor Press Exercise Tutorial", channel: "Luka Hocevar", lang: 'en', secs: 77 },
      { id: '4ULa6AJcjr8', title: "The Kettlebell Floor Press", channel: "Zack Henderson", lang: 'en', secs: 96 },
      { id: 'r__6stJd3mI', title: "This Floor Press = Special Gains!", channel: "Alex Leonidas", lang: 'en', secs: 356 },
      { id: 'i_URJN83nys', title: "The Kettlebell Floor Press", channel: "CrossFit", lang: 'en', secs: 88 },
    ],
    kb: [
      { id: 'md0deOTOC08', title: "Kettlebell 28 - single kb floor press - the basis of integrating chest press with core strength", channel: "Mark Wildman", lang: 'en', secs: 466 },
      { id: 'zGqkWqza2z8', title: "Kettlebell Floor Press | StrongFirst", channel: "StrongFirst", lang: 'en', secs: 77 },
      { id: 'mMLHrMGM408', title: "Kettlebell Floor Press", channel: "BagsBellsBodyweight", lang: 'en', secs: 146 },
      { id: '1YemOZzhvzs', title: "Jak zacząć WSTAWANIE TURECKIE kettlebell TGU? Cz.1 do floor press", channel: "Andżelika Stefańska TIGER-ZONE", lang: 'pl', secs: 745 },
    ],
  },
  pushup: {
    main: [
      { id: 'IODxDxX7oi4', title: "The Perfect Push Up | Do it right!", channel: "Calisthenicmovement", lang: 'en', secs: 218 },
      { id: 'MO10KOoQx5E', title: "The Perfect Push-Up To Build Muscle (AVOID THESE MISTAKES!)", channel: "Jeremy Ethier", lang: 'en', secs: 589 },
      { id: '5eSM88TFzAs', title: "How to Do a Push Up Correctly", channel: "P4P WORKOUTS", lang: 'en', secs: 51 },
      { id: 'boSpmZZp74U', title: "POMPKA - Prawidłowa Technika (Kalistenika)", channel: "KURA WORKOUT", lang: 'pl', secs: 117 },
      { id: 'baCcDGahK-g', title: "Pompki - Idealna Technika i Droga od 0 do 15 Pompek w Serii", channel: "Człowieku, RUSZ SIĘ!", lang: 'pl', secs: 335 },
    ],
    kb: [
      { id: 'wKPZGc_N2CU', title: "Technika Kettlebell : Pompki / Trening Siłowy", channel: "CROSSTREC", lang: 'pl', secs: 582 },
      { id: 'q8sKRd37Ca4', title: "Kettlebell Push Up (alternating hands)", channel: "Dan Skidmore", lang: 'en', secs: 50 },
      { id: 'GlXWeAglqAk', title: "Push Up Variations with Kettlebell", channel: "Breaking Muscle", lang: 'en', secs: 129 },
      { id: 'VdPwS417J4g', title: "Kettlebell Pushups - Jay Armstrong", channel: "kettlebellclub", lang: 'en', secs: 235 },
    ],
  },
  dip: {
    main: [
      { id: 'yN6Q1UI_xkE', title: "How To Do Dips For A Bigger Chest and Shoulders (Fix Mistakes!)", channel: "Jeff Nippard", lang: 'en', secs: 431 },
      { id: 'vi1-BOcj3cQ', title: "Are You Doing Dips Properly? (AVOID MISTAKES!)", channel: "ATHLEAN-X™", lang: 'en', secs: 303 },
      { id: '2z8JmcrW-As', title: "The Perfect Dip  - Do it right", channel: "Calisthenicmovement", lang: 'en', secs: 278 },
      { id: 'wLR8VJJk7W8', title: "DIPY - Prawidłowa Technika (Kalistenika)", channel: "KURA WORKOUT", lang: 'pl', secs: 168 },
      { id: 'ny3VBYF847g', title: "DIPY - NAJCZĘSTSZE BŁĘDY - POPRAW TECHNIKĘ", channel: "ProFi Academy", lang: 'pl', secs: 355 },
    ],
    kb: [
    ],
  },
  tgu: {
    main: [
      { id: '0bWRPC49-KI', title: "Turkish Get-Up Basics", channel: "StrongFirst", lang: 'en', secs: 168 },
      { id: 'jgKFttG0Z7I', title: "Primal Foundation | Kettlebell \"Turkish\" Get Up Instructional Breakdown", channel: "Eric Leija", lang: 'en', secs: 271 },
      { id: 'jFK8FOiLa_M', title: "Master the Turkish Get-Up (Avoid These 3 Mistakes!)", channel: "Squat University", lang: 'en', secs: 347 },
      { id: 'lpltjWHd0ek', title: "The Turkish Get-Up: The Ultimate Tutorial", channel: "Cat & Chau | Kettlebells", lang: 'en', secs: 285 },
      { id: '5gqHyMhJwXY', title: "Technika Kettlebell : Tureckie wstawanie / Turkish Get Up / Trening mięśni brzucha", channel: "CROSSTREC", lang: 'pl', secs: 330 },
    ],
    kb: [
      { id: 'RgKXYYHxgrY', title: "Tureckie wstawanie z Kettlebell / Turkish Get Up (TGU) Naucz się KROK PO KROKU!", channel: "Gotowy Na Trening | GNT", lang: 'pl', secs: 338 },
      { id: 'SpN-wEogszg', title: "The TURKISH GET-UP tutorial", channel: "Hardstyle Kettlebell Pro", lang: 'en', secs: 513 },
      { id: 'ljKYNGWRKXQ', title: "Kettlebell Turkish Get Up Tutorial", channel: "Brittany van Schravendijk", lang: 'en', secs: 61 },
      { id: 'YX6-DfhIx1o', title: "How to do a Turkish Get Up | Kettlebell Athletes", channel: "Bij & Gab - Kettlebell Athletes", lang: 'en', secs: 113 },
    ],
  },
  complex: {
    main: [
      { id: 'sAtZ4yAsQnI', title: "Kettlebell Clean And Press", channel: "Men's Health", lang: 'en', secs: 50 },
      { id: 'fRdlDRkAT-w', title: "STOP smacking your forearms! The proper kettlebell clean tutorial", channel: "JTM_FIT", lang: 'en', secs: 322 },
      { id: '48qvCvJJr8Y', title: "Kettlebell Clean and Press - a Primer on basic technique", channel: "Mark Wildman", lang: 'en', secs: 476 },
      { id: 'qgv6oTNZxJI', title: "Technika podnoszenia ciężarów: Zarzut - Clean", channel: "CROSSTREC", lang: 'pl', secs: 173 },
      { id: 'AqwKqy-5L6U', title: "Kettlebell Complex: Clean, Press, Squat", channel: "The Kettlebell Dude", lang: 'en', secs: 75 },
    ],
    kb: [
      { id: 'C0B1SrcGAIA', title: "Kettlebell Clean Technique (How To Not Destroy Your Wrist & Arm)", channel: "Mark Wildman", lang: 'en', secs: 413 },
      { id: 'Yzf0TBiJBvY', title: "Improve Your BJJ Fitness! Using This SIMPLE Kettlebell Complex", channel: "Bulletproof For BJJ", lang: 'en', secs: 254 },
      { id: 'iSkQEUoC22Q', title: "Clean and Squat Kettlebell Complex with Coaching Cues", channel: "Kettlebell Kings", lang: 'en', secs: 97 },
      { id: 'arDE41m8qP8', title: "KETTLEBELL CLEAN TECHNIQUE (THE BEST TUTORIAL)", channel: "Coach Gabe West", lang: 'en', secs: 223 },
    ],
  },
  carry: {
    main: [
      { id: 'y-hn_Ha1-RE', title: "How To Perform The Suitcase Carry", channel: "Dr. Carl Baird", lang: 'en', secs: 57 },
      { id: 'tNHdx7pmrGI', title: "Killer Core Strength With One Simple Movement | Suitcase Carry Exercise Tutorial", channel: "Buff Dudes Workouts", lang: 'en', secs: 266 },
      { id: '_NOpRUrI2NA', title: "Core Stability | The Suitcase Carry: A Simple Tutorial", channel: "Davis Diley", lang: 'en', secs: 146 },
      { id: 'sJmgj2cpqWA', title: "Spacer farmera jednorącz", channel: "Krystian Romanowski", lang: 'pl', secs: 61 },
      { id: 'azc2_tP7JoA', title: "Farmer’s Carry vs. Suitcase Carry - The Heavy Truth No One Tells You", channel: "Beyond Limits Lab", lang: 'en', secs: 487 },
    ],
    kb: [
      { id: 'd6i6MwVOmk0', title: "Build Your Core Quickly - Kettlebell 56 Suitcase Deadlift", channel: "Mark Wildman", lang: 'en', secs: 479 },
      { id: 'CsSQtaE9SAQ', title: "How to Perform Kettlebell Suitcase Carries", channel: "CORE Strong Fitness", lang: 'en', secs: 47 },
      { id: 'smkxkmKh0ns', title: "Kettlebell Essential Exercises: The Mighty Rack Carry For Core Training", channel: "Physical Upgrade South Jersey", lang: 'en', secs: 84 },
      { id: 'T9A607GaR2w', title: "SINGLE-ARM SUITCASE CARRY", channel: "Hardstyle Kettlebell Pro", lang: 'en', secs: 185 },
    ],
  },
  farmer: {
    main: [
      { id: 'Ujv88lNIxP0', title: "How Farmers Walks Completely Change The Human Body", channel: "FitZip", lang: 'en', secs: 515 },
      { id: 'NH7Xv-7NQNQ', title: "How To Perform Farmer Walks Exercise Tutorial", channel: "Buff Dudes Workouts", lang: 'en', secs: 90 },
      { id: 'nqGfgIVteoM', title: "The Farmer's Walk Dumbbell Tutorial - Discover the Benefits", channel: "Fit Father Project - Fitness For Busy Fathers", lang: 'en', secs: 314 },
      { id: 'Fkzk_RqlYig', title: "How to Perform the Farmer's Walk - Exercise Tutorial", channel: "Buff Dudes", lang: 'en', secs: 70 },
      { id: 'z7E_YU9P1jU', title: "How to Perform the Farmer’s Carry", channel: "Dr. Carl Baird", lang: 'en', secs: 140 },
    ],
    kb: [
      { id: 'LLCwJWE67aU', title: "Kettlebell Carry Variations", channel: "USA Iron", lang: 'en', secs: 149 },
      { id: 'VVTTgdZ5Is8', title: "Kettlebell Carry Variations", channel: "EliteAthletesBE", lang: 'en', secs: 96 },
      { id: '92cwGLa-wdQ', title: "Kettlebell Farmer Walk w/ Strength Coach Zach Even-Esh", channel: "Criticalbench", lang: 'en', secs: 204 },
      { id: 'rXfErEPlsh8', title: "hyrox farmers carry tips to go faster in your hyrox race / hyrox training kettlebell carry tips", channel: "HYROX HUB", lang: 'en', secs: 134 },
    ],
  },
  core: {
    main: [
      { id: 'Pr1ieGZ5atk', title: "Hanging Leg Raise | HOW-TO", channel: "ATHLEAN-X™", lang: 'en', secs: 276 },
      { id: 'hf00_b2sRdc', title: "How to Perfect Your Hollow Hold | Form Check | Men's Health", channel: "Men's Health", lang: 'en', secs: 190 },
      { id: 'QyVq5oUBpss', title: "The WORST Ab Training MISTAKES | Leg Raises", channel: "FitnessFAQs", lang: 'en', secs: 311 },
      { id: 'agOcJPXoBpA', title: "ZBUDUJ KRATĘ NA BRZUCHU  ZMIENIAJĄC ZNANE ĆWICZENIE", channel: "Szymon Moszny", lang: 'pl', secs: 232 },
      { id: 'aKGKFAun6lY', title: "Hollow Body- jak poprawnie ćwiczyć brzuch", channel: "Studio Treningu Personalnego - Body Change Center", lang: 'pl', secs: 101 },
    ],
    kb: [
      { id: 'tG4d0Be02lk', title: "20 Minute Kettlebell Core Workout With Vocal Instructions! Get STRONG ABS!", channel: "Workout With Roxanne", lang: 'en', secs: 1268 },
      { id: 'NgJtWvgQkJg', title: "Top 10 Kettlebell Core Exercises to build functional strength", channel: "JTM_FIT", lang: 'en', secs: 424 },
      { id: 'sewaX21jfoU', title: "Kettlebell ABS Workout | 15 minute No Repeat Sixpack", channel: "DANIELPT FITNESS", lang: 'en', secs: 919 },
      { id: 'LgJopMsyvv8', title: "15-Minute Abs and Core Kettlebell Workout (All Standing)", channel: "nourishmovelove", lang: 'en', secs: 935 },
    ],
  },
  calf: {
    main: [
      { id: '-M4-G8p8fmc', title: "How to Do a Calf Raise | Sexy Legs Workout", channel: "Howcast", lang: 'en', secs: 111 },
      { id: 'CtyIVeJH6lI', title: "You're Doing Calf Raises WRONG | The Correct Way Taught By Physical Therapist", channel: "Rehab and Revive", lang: 'en', secs: 108 },
      { id: 'k67UjgvJdEk', title: "Standing Calf Raise", channel: "ChadMollickDotCom", lang: 'en', secs: 58 },
      { id: '7ti1VEuyyBQ', title: "Standing Calf Raises", channel: "KURU Footwear | Shoes for Foot Pain & Heel Support", lang: 'en', secs: 52 },
      { id: 'mbyTbDJBsR8', title: "Trening nóg (łydek) - wspięcia na palce obunóż, stojąc - Atlas Ćwiczeń SFD", channel: "PoTreningu", lang: 'pl', secs: 61 },
    ],
    kb: [
      { id: 'LAyuvZSGPVc', title: "KETTLEBELL ONLY MUSCLE GAIN : CALF TRAINING ?", channel: "Joe Daniels Kettlebell Muscle Gain", lang: 'en', secs: 186 },
      { id: 'pygzNIPc_cA', title: "Intense 5 Minute Kettlebell Calf Workout", channel: "Anabolic Aliens", lang: 'en', secs: 391 },
      { id: 'qkK_V6hpQ80', title: "Kettlebell Kings Presents: Standing Kettlebell Calf Raise - Kettlebells 4 Aesthetics", channel: "Kettlebell Kings", lang: 'en', secs: 60 },
    ],
  },
  calf1: {
    main: [
      { id: 'ORT4oJ_R8Qs', title: "How To: Single-Leg Calf Raise", channel: "ScottHermanFitness", lang: 'en', secs: 107 },
      { id: 'PMpjpJBA0Og', title: "Wspięcia na palce jednonóz z hantlem trzymanym w dłoni", channel: "budujmase.pl", lang: 'pl', secs: 100 },
      { id: 'HmgXnST4Mdw', title: "The Calf Raise - Exercise Progression | Tim Keeley | Physio REHAB", channel: "Physio REHAB", lang: 'en', secs: 481 },
      { id: 's-NoA27XIdM', title: "Single Leg Calf Raise Assessment", channel: "Gait Happens", lang: 'en', secs: 91 },
      { id: 'PGzcmhEsFdw', title: "Calf Raises - Importance of Straight and Bent Knee Versions!", channel: "PAIN SLAYERS GRACEVILLE PHYSIO", lang: 'en', secs: 113 },
    ],
    kb: [
      { id: 'KxKZEFddDwA', title: "Single Leg Kettlebell Calf Raise", channel: "Hone Gym", lang: 'en', secs: 62 },
      { id: 'pygzNIPc_cA', title: "Intense 5 Minute Kettlebell Calf Workout", channel: "Anabolic Aliens", lang: 'en', secs: 391 },
      { id: 'qkK_V6hpQ80', title: "Kettlebell Kings Presents: Standing Kettlebell Calf Raise - Kettlebells 4 Aesthetics", channel: "Kettlebell Kings", lang: 'en', secs: 60 },
    ],
  },
};
