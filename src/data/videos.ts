import type { ExerciseId, VideoRef } from '../types';

/**
 * Filmy instruktażowe dla każdego ćwiczenia z biblioteki.
 *
 * Lista nie jest pisana z pamięci. Powstała z wyników wyszukiwania YouTube: kandydaci są
 * odsiewani po długości i tytule, oceniani liczbą wyświetleń wraz z pozycją w wynikach,
 * ograniczani do jednego filmu na kanał, a na końcu każdy identyfikator sprawdzono przez
 * oEmbed i stronę osadzania — odpadłyby filmy usunięte, prywatne i z wyłączonym osadzaniem.
 * Aplikacja jest po polsku, więc do dwóch miejsc na ćwiczenie rezerwowane jest na nagrania
 * polskie, resztę zajmują najmocniejsze angielskie.
 *
 * Wygenerowane 2026-09-02. Autorzy czasem usuwają filmy, dlatego
 * każda karta ma obok odtwarzacza zwykły link do YouTube — martwe osadzenie nie psuje strony.
 */
export const VIDEOS: Record<ExerciseId, VideoRef[]> = {
  swing2: [
    { id: 'sSESeQAir2M', title: "How To Do A Kettlebell Swing | The Right Way | Well+Good", channel: "Well+Good", lang: 'en', secs: 153 },
    { id: 'LBhaLLc153A', title: "The Kettlebell Swing Technique Everyone Gets WRONG!", channel: "Squat University", lang: 'en', secs: 232 },
    { id: 'DqkYuWR4zRI', title: "HOW TO DO A KETTLEBELL SWING WITHOUT HURTING YOUR BACK!", channel: "Dr. Dan's Plan", lang: 'en', secs: 169 },
    { id: 'xOEVB9_rKfY', title: "POPRAWNA TECHNIKA SWINGU I BŁĘDY", channel: "ProFi Academy", lang: 'pl', secs: 220 },
  ],
  swing1: [
    { id: 'BXrXhyudA80', title: "One Arm Kettlebell Swing by Pavel Tsatsouline", channel: "Strong And Fit", lang: 'en', secs: 130 },
    { id: 'zSww9F2ZEW8', title: "STOP DOING SH*TTY KETTLEBELL SWINGS", channel: "Kelly Matthews", lang: 'en', secs: 426 },
    { id: 'eMrqzxXO0WM', title: "Swing jednorącz czyli najważniejsze ćwiczenie z kettlami.", channel: "Squats - Swings - Other - Things", lang: 'pl', secs: 516 },
    { id: '7-0unAeFLL0', title: "TECHNIKA SWINGU JEDNORĄCZ - 5 prostych kroków! | *kettlebell*", channel: "Trenuj Wszechstronnie", lang: 'pl', secs: 420 },
  ],
  rdl: [
    { id: '_oyxCn2iSjU', title: "HOW TO DO ROMANIAN DEADLIFTS (RDLs): Build Beefy Hamstrings With Perfect Technique", channel: "Jeff Nippard", lang: 'en', secs: 382 },
    { id: '5zmlnbWb-g4', title: "Stop F*cking Up RDL's (PROPER FORM!)", channel: "ATHLEAN-X™", lang: 'en', secs: 351 },
    { id: 'KCb97iPJsC0', title: "RUMUŃSKI MARTWY CIĄG - TYPOWE BŁĘDY", channel: "ProFi Academy", lang: 'pl', secs: 329 },
    { id: 'LFSz_gdW-pw', title: "Rumuński Martwy Ciąg - PRAWIDŁOWA Technika (Przestań Popełniać Te Błędy)", channel: "Piotr 'Szmexy' Tomaszewski", lang: 'pl', secs: 486 },
  ],
  goblet: [
    { id: '9W5KAqHfDe8', title: "The Goblet Squat Exercise Guide - The Proper Form, Sets & Routine Tutorial", channel: "Fit Father Project - Fitness For Busy Fathers", lang: 'en', secs: 208 },
    { id: 'gCESNsDsbqk', title: "Goblet Squats: Proper Form & Technique", channel: "BuiltLean®", lang: 'en', secs: 66 },
    { id: 'kPHqY59DYEQ', title: "GOBLET SQUAT- naucz się przysiadu w 4 minuty⏰", channel: "MADESIRE", lang: 'pl', secs: 242 },
    { id: 'fB39vO4dA9Y', title: "GOBLET SQUAT  - POPRAWA MOBILNOŚCI W PRZYSIADZIE", channel: "ProFi Academy", lang: 'pl', secs: 167 },
  ],
  lunge: [
    { id: 'uImsgS-5P28', title: "Kettlebell Front Rack Lunge", channel: "PappasFit", lang: 'en', secs: 65 },
    { id: '73OwYFfga1g', title: "Front rack reverse lunge - Explode Your Leg Strength!", channel: "Performance Edge Crossfit", lang: 'en', secs: 110 },
    { id: 'VhTIWTgXk6g', title: "Double Kettlebell Front Rack Lunge", channel: "Headstrong Fit", lang: 'en', secs: 59 },
    { id: 'f5DTQ-w2J9c', title: "Front Rack Reverse Lunge", channel: "LOOK STRONG NAKED", lang: 'en', secs: 88 },
  ],
  row: [
    { id: 'roCP6wCXPqo', title: "How to Perfect Your Dumbbell Row | Form Check | Men's Health", channel: "Men's Health", lang: 'en', secs: 196 },
    { id: 'dFzUjzfih7k', title: "How to do the SINGLE ARM DUMBBELL ROW! | 2 Minute Tutorial", channel: "Max Euceda", lang: 'en', secs: 120 },
    { id: '8hClc1TBMak', title: "Wiosłowanie hantlem jednorącz w podporze o ławkę", channel: "budujmase.pl", lang: 'pl', secs: 104 },
    { id: 'YAEBKTpH2lw', title: "Wiosłowanie hantlem - jak ćwiczyć żeby ROSNĄĆ?", channel: "Tomek Grzymski", lang: 'pl', secs: 384 },
  ],
  pullup: [
    { id: 'eGo4IYlbE5g', title: "The Perfect Pull Up  - Do it right!", channel: "Calisthenicmovement", lang: 'en', secs: 272 },
    { id: 'bb8_5vZV5dU', title: "Go from 0 to 10 Pull-Ups FAST", channel: "Gravity Transformation - Fat Loss Experts", lang: 'en', secs: 735 },
    { id: 'YYbqPzlwY6c', title: "JAK WIĘCEJ SIĘ PODCIĄGAĆ? *od 0 do 20 powtórzeń!*", channel: "Tomek Grzymski", lang: 'pl', secs: 428 },
    { id: 'UvW6XnClK7A', title: "PODCIĄGANIE - Prawidłowa Technika (KALISTENIKA)", channel: "KURA WORKOUT", lang: 'pl', secs: 131 },
  ],
  curl: [
    { id: 'jjnJHhzZUUM', title: "STOP Doing Bicep Curls Like This (5 Mistakes Slowing Your Gains)", channel: "Jeremy Ethier", lang: 'en', secs: 454 },
    { id: 'XE_pHwbst04', title: "Bicep Curls — (DUMBBELL FORM & TECHNIQUE)", channel: "Fit Father Project - Fitness For Busy Fathers", lang: 'en', secs: 159 },
    { id: 'ykJmrZ5v0Oo', title: "How to Do a Dumbbell Biceps Curl | Arm Workout", channel: "Howcast", lang: 'en', secs: 109 },
    { id: 'kdwwJSGrum0', title: "NIE POPEŁNIAJ TYCH BŁĘDÓW W TRENINGU BICEPSÓW!", channel: "Szymon Moszny", lang: 'pl', secs: 238 },
  ],
  press: [
    { id: 'Tr31MZxZ5o0', title: "Kettlebell Overhead Press - How to Coach", channel: "Alloy Personal Training Franchise", lang: 'en', secs: 173 },
    { id: 'XHkI03S6Pls', title: "Kettlebell 14 - intro to the Single arm Kettlebell overhead press - essential athletic development", channel: "Mark Wildman", lang: 'en', secs: 336 },
    { id: 'WMb8U-V-6ek', title: "STOP Making This Overhead Press MISTAKE!", channel: "Lebe Stark", lang: 'en', secs: 426 },
    { id: 'OSUT594ZLI4', title: "WYCISKANIE ŻOŁNIERSKIE ODWAŻNIKIEM KULOWYM - Podstawy kettlebells cz.10", channel: "Łukasz Śliwa", lang: 'pl', secs: 637 },
  ],
  floor: [
    { id: 'QsYre__-aro', title: "STOP Doing Dumbbell Press Like This (5 Mistakes Slowing Your Chest Gains)", channel: "Jeremy Ethier", lang: 'en', secs: 449 },
    { id: 'B340QckIfJM', title: "1 Arm Kettlebell Floor Press Exercise Tutorial", channel: "Luka Hocevar", lang: 'en', secs: 77 },
    { id: '4ULa6AJcjr8', title: "The Kettlebell Floor Press", channel: "Zack Henderson", lang: 'en', secs: 96 },
    { id: 'r__6stJd3mI', title: "This Floor Press = Special Gains!", channel: "Alex Leonidas", lang: 'en', secs: 356 },
  ],
  pushup: [
    { id: 'IODxDxX7oi4', title: "The Perfect Push Up | Do it right!", channel: "Calisthenicmovement", lang: 'en', secs: 218 },
    { id: 'MO10KOoQx5E', title: "The Perfect Push-Up To Build Muscle (AVOID THESE MISTAKES!)", channel: "Jeremy Ethier", lang: 'en', secs: 589 },
    { id: 'boSpmZZp74U', title: "POMPKA - Prawidłowa Technika (Kalistenika)", channel: "KURA WORKOUT", lang: 'pl', secs: 117 },
    { id: 'baCcDGahK-g', title: "Pompki - Idealna Technika i Droga od 0 do 15 Pompek w Serii", channel: "Człowieku, RUSZ SIĘ!", lang: 'pl', secs: 335 },
  ],
  dip: [
    { id: 'yN6Q1UI_xkE', title: "How To Do Dips For A Bigger Chest and Shoulders (Fix Mistakes!)", channel: "Jeff Nippard", lang: 'en', secs: 431 },
    { id: 'vi1-BOcj3cQ', title: "Are You Doing Dips Properly? (AVOID MISTAKES!)", channel: "ATHLEAN-X™", lang: 'en', secs: 303 },
    { id: 'wLR8VJJk7W8', title: "DIPY - Prawidłowa Technika (Kalistenika)", channel: "KURA WORKOUT", lang: 'pl', secs: 168 },
    { id: 'ny3VBYF847g', title: "DIPY - NAJCZĘSTSZE BŁĘDY - POPRAW TECHNIKĘ", channel: "ProFi Academy", lang: 'pl', secs: 355 },
  ],
  tgu: [
    { id: '0bWRPC49-KI', title: "Turkish Get-Up Basics", channel: "StrongFirst", lang: 'en', secs: 168 },
    { id: 'jgKFttG0Z7I', title: "Primal Foundation | Kettlebell \"Turkish\" Get Up Instructional Breakdown", channel: "Eric Leija", lang: 'en', secs: 271 },
    { id: 'jFK8FOiLa_M', title: "Master the Turkish Get-Up (Avoid These 3 Mistakes!)", channel: "Squat University", lang: 'en', secs: 347 },
    { id: '5gqHyMhJwXY', title: "Technika Kettlebell : Tureckie wstawanie / Turkish Get Up / Trening mięśni brzucha", channel: "CROSSTREC", lang: 'pl', secs: 330 },
  ],
  complex: [
    { id: 'sAtZ4yAsQnI', title: "Kettlebell Clean And Press", channel: "Men's Health", lang: 'en', secs: 50 },
    { id: 'fRdlDRkAT-w', title: "STOP smacking your forearms! The proper kettlebell clean tutorial", channel: "JTM_FIT", lang: 'en', secs: 322 },
    { id: '48qvCvJJr8Y', title: "Kettlebell Clean and Press - a Primer on basic technique", channel: "Mark Wildman", lang: 'en', secs: 476 },
    { id: 'qgv6oTNZxJI', title: "Technika podnoszenia ciężarów: Zarzut - Clean", channel: "CROSSTREC", lang: 'pl', secs: 173 },
  ],
  carry: [
    { id: 'y-hn_Ha1-RE', title: "How To Perform The Suitcase Carry", channel: "Dr. Carl Baird", lang: 'en', secs: 57 },
    { id: 'tNHdx7pmrGI', title: "Killer Core Strength With One Simple Movement | Suitcase Carry Exercise Tutorial", channel: "Buff Dudes Workouts", lang: 'en', secs: 266 },
    { id: '_NOpRUrI2NA', title: "Core Stability | The Suitcase Carry: A Simple Tutorial", channel: "Davis Diley", lang: 'en', secs: 146 },
    { id: 'sJmgj2cpqWA', title: "Spacer farmera jednorącz", channel: "Krystian Romanowski", lang: 'pl', secs: 61 },
  ],
  farmer: [
    { id: 'Ujv88lNIxP0', title: "How Farmers Walks Completely Change The Human Body", channel: "FitZip", lang: 'en', secs: 515 },
    { id: 'NH7Xv-7NQNQ', title: "How To Perform Farmer Walks Exercise Tutorial", channel: "Buff Dudes Workouts", lang: 'en', secs: 90 },
    { id: 'nqGfgIVteoM', title: "The Farmer's Walk Dumbbell Tutorial - Discover the Benefits", channel: "Fit Father Project - Fitness For Busy Fathers", lang: 'en', secs: 314 },
    { id: 'Fkzk_RqlYig', title: "How to Perform the Farmer's Walk - Exercise Tutorial", channel: "Buff Dudes", lang: 'en', secs: 70 },
  ],
  core: [
    { id: 'Pr1ieGZ5atk', title: "Hanging Leg Raise | HOW-TO", channel: "ATHLEAN-X™", lang: 'en', secs: 276 },
    { id: 'hf00_b2sRdc', title: "How to Perfect Your Hollow Hold | Form Check | Men's Health", channel: "Men's Health", lang: 'en', secs: 190 },
    { id: 'agOcJPXoBpA', title: "ZBUDUJ KRATĘ NA BRZUCHU  ZMIENIAJĄC ZNANE ĆWICZENIE", channel: "Szymon Moszny", lang: 'pl', secs: 232 },
    { id: 'aKGKFAun6lY', title: "Hollow Body- jak poprawnie ćwiczyć brzuch", channel: "Studio Treningu Personalnego - Body Change Center", lang: 'pl', secs: 101 },
  ],
  calf: [
    { id: '-M4-G8p8fmc', title: "How to Do a Calf Raise | Sexy Legs Workout", channel: "Howcast", lang: 'en', secs: 111 },
    { id: 'CtyIVeJH6lI', title: "You're Doing Calf Raises WRONG | The Correct Way Taught By Physical Therapist", channel: "Rehab and Revive", lang: 'en', secs: 108 },
    { id: 'k67UjgvJdEk', title: "Standing Calf Raise", channel: "ChadMollickDotCom", lang: 'en', secs: 58 },
    { id: 'mbyTbDJBsR8', title: "Trening nóg (łydek) - wspięcia na palce obunóż, stojąc - Atlas Ćwiczeń SFD", channel: "PoTreningu", lang: 'pl', secs: 61 },
  ],
  calf1: [
    { id: 'ORT4oJ_R8Qs', title: "How To: Single-Leg Calf Raise", channel: "ScottHermanFitness", lang: 'en', secs: 107 },
    { id: 'PMpjpJBA0Og', title: "Wspięcia na palce jednonóz z hantlem trzymanym w dłoni", channel: "budujmase.pl", lang: 'pl', secs: 100 },
    { id: 'HmgXnST4Mdw', title: "The Calf Raise - Exercise Progression | Tim Keeley | Physio REHAB", channel: "Physio REHAB", lang: 'en', secs: 481 },
    { id: 's-NoA27XIdM', title: "Single Leg Calf Raise Assessment", channel: "Gait Happens", lang: 'en', secs: 91 },
  ],
};
