import { useState, useEffect } from "react";
import { useNavigate } from "../router";
import { apiGetMe, apiUpdateMe, saveFbUser, apiGetFriends, type PublicUser } from "../lib/api";
import StorageSection from "../components/StorageSection";
import { WORLD_CITIES, WORLD_MUSIC_GENRES } from "../lib/world-data";

/* ── Extended profile (localStorage only — not in DB yet) ──────────────────── */
interface ExtProfile {
  hometown: string;
  birthDay: string; birthMonth: string; birthYear: string;
  birthPrivacy: "public" | "friends" | "only_me";
  relationship: string;
  family: string;
  gender: string;
  genderPrivacy: "public" | "friends" | "only_me";
  languages: string;
  experience: string;
  education: string;
  hobbies: string;
  interestMusic: string; interestTv: string; interestMovies: string;
  interestGames: string; interestSports: string;
  travelPlaces: string;
  websites: string;
  socialLinks: string;
  extraPhones: string[];
}

const DEFAULT_EXT: ExtProfile = {
  hometown: "", birthDay: "", birthMonth: "", birthYear: "",
  birthPrivacy: "friends", relationship: "", family: "", gender: "",
  genderPrivacy: "only_me", languages: "", experience: "", education: "",
  hobbies: "", interestMusic: "", interestTv: "", interestMovies: "",
  interestGames: "", interestSports: "", travelPlaces: "",
  websites: "", socialLinks: "", extraPhones: [],
};

function loadExt(): ExtProfile {
  try { return { ...DEFAULT_EXT, ...JSON.parse(localStorage.getItem("fb_profile_ext") ?? "{}") }; }
  catch { return DEFAULT_EXT; }
}
function saveExt(ext: ExtProfile) {
  localStorage.setItem("fb_profile_ext", JSON.stringify(ext));
}

const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const PRIVACY_LABEL: Record<string, string> = { public: "Public", friends: "Amis", only_me: "Moi uniquement" };
const PRIVACY_ICON:  Record<string, string> = { public: "🌐", friends: "👥", only_me: "🔒" };
const PRIVACY_OPTS = ["public","friends","only_me"] as const;

/* ── Suggestion data per sub-view ──────────────────────────────────────────── */


const SUGGESTIONS: Partial<Record<SubView, { items: string[]; multi?: boolean }>> = {
  city:     { items: WORLD_CITIES },
  hometown: { items: WORLD_CITIES },
  places:   { multi: true, items: WORLD_CITIES },
  music:    { multi: true, items: WORLD_MUSIC_GENRES },
  relationship: { items: ["Célibataire","En couple","Fiancé(e)","Marié(e)","Divorcé(e)","Veuf / Veuve","C'est compliqué"] },
  languages: { multi: true, items: [
    // Langues officielles & majeures
    "Français","Anglais","Arabe","Portugais","Espagnol","Mandarin","Hindi","Russe","Bengali",
    "Japonais","Coréen","Allemand","Swahili","Haoussa","Yoruba","Igbo","Amharique","Tamoul",
    "Vietnamien","Turc","Polonais","Ukrainien","Néerlandais","Grec","Tchèque","Roumain","Hongrois",
    "Indonésien","Malais","Thaïlandais","Ourdou","Penjabi","Gujarati","Marathe","Télougou","Kannada",
    "Persan (Farsi)","Pachto","Birman","Khmer","Laotien","Sinhalais","Népalais","Mongol","Ouzbek",
    "Kazakh","Azerbaïdjanais","Géorgien","Arménien","Albanais","Serbe","Croate","Bulgare","Slovaque",
    "Slovène","Lituanien","Letton","Estonien","Finnois","Suédois","Norvégien","Danois","Islandais",
    "Hébreu","Somali","Tigrigna","Oromo","Zoulou","Xhosa","Sotho","Shona","Ndebele","Tswana",
    // Langues africaines
    "Wolof","Bambara","Dioula","Fon","Éwé","Twi","Peul","Lingala","Kinyarwanda","Kirundi",
    "Baoulé","Agni","Bété","Guéré","Senoufo","Mossi","Soninké","Manding","Sérère","Toucouleur",
    "Bemba","Luganda","Luo","Kikuyu","Chewa","Meru","Gikuyu","Luhya","Kamba","Giriama",
    "Dendi","Bariba","Fon","Adja","Mina","Kotokoli","Ditamari","Yom","Natimba",
    "Kabiyè","Lama","Moba","Gurma","Tem","Akposso","Bassar","Nawuri",
    "Moore","Dioula-Burkina","Bissa","Dagara","Nuni","Lobi","San","Bobo","Pougouli",
    "Malinké","Soussou","Pular","Toma","Guerze","Kpellé","Kissi","Temne","Mende","Limba",
    "Mandingue","Sarakolé","Diola","Balante","Manjak","Mandja","Ndorobo",
    "Fulfuldé","Kanouri","Zerma","Touareg","Toubou","Arab-Choa","Peul du Niger",
    "Fang","Beti","Bassa","Bamiléké","Duala","Ewondo","Fulfulde camerounais",
    "Lingala","Luba","Kongo","Mongo","Kuba","Tetela","Ngbandi","Zande","Mangbetu",
    "Malagasy","Comorien","Créole seychellois","Créole mauricien","Créole réunionnais",
    "Haoussa","Yoruba","Igbo","Ijaw","Tiv","Efik","Ibibio","Urhobo","Nupe","Kanuri",
    // Créoles et langues mixtes
    "Créole haïtien","Créole martiniquais","Créole guadeloupéen","Créole capverdien (Kriolu)",
    "Créole guyanais","Tok Pisin","Bislama","Pijin","Pidgin nigérian","Pidgin camerounais",
    // Langues asiatiques supplémentaires
    "Cantonais","Shanghainais","Min Nan","Hakka","Tibétain","Ouïghour","Zhuang",
    "Javanais","Soundanais","Balinais","Betawi","Madurais","Minangkabau","Bugis",
    "Ilocano","Cebuano","Hiligaynon","Waray","Kapampangan","Pangasinan",
    "Sinhala","Dhivehi","Dzongkha","Newari","Maithili","Bhojpuri","Rajasthani",
  ] },
  experience: { items: [
    // Tech
    "Développeur web Fullstack","Développeur frontend (React / Vue)","Développeur backend (Node / Python / Java)",
    "Développeur mobile (React Native / Flutter)","Développeur iOS (Swift)","Développeur Android (Kotlin)",
    "Ingénieur logiciel","Ingénieur DevOps / SRE","Ingénieur Cloud (AWS / GCP / Azure)","Ingénieur QA / Test",
    "Data Engineer","Data Analyst","Data Scientist","Ingénieur IA / Machine Learning","Prompt Engineer",
    "Administrateur systèmes","Administrateur réseaux","Ingénieur cybersécurité","Architecte solutions",
    "CTO","Tech Lead","Engineering Manager","VP Engineering",
    // Design & créativité
    "Designer UI/UX","Designer graphique","Designer produit","Motion designer","3D Designer / Modeleur",
    "Photographe professionnel","Vidéaste / Réalisateur","Monteur vidéo","Directeur artistique","Illustrateur",
    "Créateur de contenu","YouTuber / TikToker","Podcast host","Influenceur","Streamer",
    // Business & management
    "Entrepreneur / Fondateur","CEO / PDG","COO","CFO","CMO","CPO",
    "Chef de projet","Product Manager","Product Owner","Scrum Master","Agile Coach",
    "Business Analyst","Business Developer","Directeur commercial","Responsable des ventes","Key Account Manager",
    "Consultant en stratégie","Consultant en management","Consultant IT","Conseil en organisation",
    // Marketing & communication
    "Responsable marketing digital","Community Manager","Social Media Manager","Growth Hacker",
    "SEO / SEM Specialist","Email Marketing Specialist","Content Manager","Copywriter","Brand Manager",
    "Chargé de communication","Relations presse","Attaché de presse","Responsable événementiel",
    // Finance & comptabilité
    "Comptable","Expert-comptable","Auditeur interne","Auditeur externe","Contrôleur de gestion",
    "Directeur financier","Analyste financier","Trésorier","Consultant financier","Fiscaliste",
    "Banquier","Conseiller clientèle bancaire","Gestionnaire de patrimoine","Trader","Analyste crédit",
    "Agent d'assurance","Actuaire","Courtier en assurance","Gestionnaire de fonds",
    // Santé
    "Médecin généraliste","Médecin spécialiste","Chirurgien","Pédiatre","Gynécologue","Cardiologue",
    "Radiologue","Dermatologue","Ophtalmologue","ORL","Dentiste","Orthodontiste","Chirurgien-dentiste",
    "Infirmier / Infirmière","Sage-femme","Aide-soignant","Kinésithérapeute","Ergothérapeute",
    "Pharmacien","Biologiste","Laborantin","Technicien de santé","Ambulancier","Secouriste",
    "Nutritionniste / Diététicien","Psychologue","Psychiatre","Psychothérapeute","Coach bien-être",
    "Vétérinaire","Ingénieur en santé publique","Épidémiologiste","Chercheur médical",
    // Éducation
    "Enseignant du primaire","Enseignant du secondaire","Professeur universitaire","Maître de conférences",
    "Formateur professionnel","Coach académique","Tuteur / Répétiteur","Directeur d'école","Proviseur",
    "Ingénieur pédagogique","Concepteur de formation e-learning","Conseiller d'orientation",
    "Bibliothécaire","Documentaliste","Archiviste",
    // Droit & administration
    "Avocat","Notaire","Huissier","Juriste d'entreprise","Conseiller juridique","Magistrat","Juge",
    "Fonctionnaire","Administrateur civil","Diplomate","Attaché d'ambassade","Agent consulaire",
    "Policier / Gendarme","Militaire","Pompier","Agent de sécurité","Garde du corps",
    // Ingénierie & BTP
    "Ingénieur civil / BTP","Architecte","Ingénieur structures","Ingénieur hydraulique",
    "Ingénieur électrique","Ingénieur mécanique","Ingénieur industriel","Ingénieur aéronautique",
    "Ingénieur pétrolier / gazier","Ingénieur minier","Géologue","Topographe","Géomètre",
    "Ingénieur en énergie renouvelable","Ingénieur environnement","Technicien de maintenance",
    // Commerce & logistique
    "Commercial terrain","Responsable achats","Acheteur","Logisticien","Supply chain manager",
    "Transitaire","Agent de fret","Douanier / Agent en douane","Importateur / Exportateur",
    "Agent immobilier","Promoteur immobilier","Gestionnaire de patrimoine immobilier",
    "Gérant de boutique","Commerçant","Grossiste","Détaillant","E-commerçant","Drop-shipper",
    // Agriculture & environnement
    "Agriculteur","Agroéconomiste","Ingénieur agronome","Vétérinaire rural",
    "Pêcheur","Éleveur","Arboriculteur","Maraîcher","Exploitant forestier",
    "Écologiste","Biologiste environnemental","Expert en développement durable",
    // Art & culture
    "Artiste musicien","Chanteur / Chanteuse","DJ","Producteur musical","Beatmaker","Auteur-compositeur",
    "Acteur / Actrice","Réalisateur","Scénariste","Producteur de films","Directeur de casting",
    "Danseur / Danseuse","Chorégraphe","Comédien de théâtre","Humoriste / Comédien",
    "Styliste","Couturier / Modiste","Designer de mode","Maquilleur artistique","Coiffeur styliste",
    // Freelance & indépendant
    "Freelance développeur","Freelance designer","Freelance traducteur","Freelance rédacteur",
    "Consultant indépendant","Auto-entrepreneur","Gérant de PME","Gérant de startup",
  ] },
  education: { items: [
    // Baccalauréats africains
    "Baccalauréat Série D (Sciences expérimentales)","Baccalauréat Série C (Maths & Physique)",
    "Baccalauréat Série A (Lettres)","Baccalauréat Série G (Commerce)","Baccalauréat Série F (Technique)",
    "Baccalauréat Technique Industriel","Brevet de Technicien Supérieur (BTS)",
    // BTS / DUT
    "BTS Informatique","BTS Génie Logiciel","BTS Réseaux & Télécoms","BTS Électronique",
    "BTS Commerce","BTS Comptabilité","BTS Finance-Banque","BTS Assurance","BTS Secrétariat",
    "BTS Communication","BTS Marketing","BTS Ressources Humaines","BTS Logistique & Transport",
    "BTS Bâtiment & Travaux Publics","BTS Maintenance Industrielle","BTS Électrotechnique",
    "BTS Tourisme & Hôtellerie","BTS Agriculture","BTS Santé communautaire",
    "DUT Informatique","DUT Réseaux & Télécoms","DUT Génie civil","DUT Mécanique",
    "DUT Génie électrique","DUT Marketing","DUT GEA (Gestion des Entreprises et Administrations)",
    // Licences africaines
    "Licence Informatique — UAC (Bénin)","Licence Informatique — UCAO","Licence Informatique — UGB",
    "Licence Informatique — UFÉMI","Licence Informatique — Université de Lomé",
    "Licence Mathématiques","Licence Physique-Chimie","Licence Biologie","Licence Géologie",
    "Licence Économie","Licence Gestion","Licence Comptabilité","Licence Finance",
    "Licence Droit public","Licence Droit privé","Licence Droit des Affaires",
    "Licence Lettres Modernes","Licence Philosophie","Licence Sociologie","Licence Psychologie",
    "Licence Histoire","Licence Géographie","Licence Communication","Licence Journalisme",
    "Licence Langues Étrangères Appliquées (LEA)","Licence Traduction","Licence Tourisme",
    "Licence Sciences de l'Éducation","Licence Santé Publique","Licence Biochimie",
    "Licence Sciences Infirmières","Licence Pharmacie (L1–L3)","Licence Médecine (L1–L3)",
    // Masters africains
    "Master en Gestion — CESAG (Dakar)","Master Finance — ESCA Maroc","Master MBA — IAG",
    "Master Marketing digital","Master Communication digitale","Master Management",
    "Master Gestion de Projets","Master RH","Master Droit des Affaires","Master Droit International",
    "Master Informatique","Master Cybersécurité","Master Data Science","Master IA",
    "Master Développement International","Master Économie du Développement",
    "Master Relations Internationales","Master Sciences Politiques","Master Diplomatie",
    "Master Santé Publique","Master Épidémiologie","Master Nutrition",
    "Master Ingénierie — INP-HB (CI)","Master Génie Civil","Master Génie Électrique",
    "Master Génie Informatique — ESP (Dakar)","Master Télécoms — ESMT","Master Énergies Renouvelables",
    // Grandes écoles & ingénieurs
    "Ingénieur Génie Civil — INP-HB","Ingénieur Informatique — ESP","Ingénieur Télécoms — ESMT",
    "Ingénieur Agroalimentaire","Ingénieur Chimie","Ingénieur Minier","Ingénieur Pétrolier",
    "Ingénieur Mécanique","Ingénieur Électronique","Ingénieur Environnement",
    // Doctorats
    "Doctorat Médecine","Doctorat Pharmacie","Doctorat Chirurgie Dentaire","Doctorat Vétérinaire",
    "Doctorat Informatique","Doctorat Mathématiques","Doctorat Sciences Physiques",
    "Doctorat Droit","Doctorat Économie","Doctorat Sociologie","Doctorat Littérature",
    // MBA / Exec
    "MBA — HECI Dakar","MBA — ESCA Casablanca","MBA — ISM Dakar","MBA — IAG Abidjan",
    "Executive MBA","MBA Finance","MBA Marketing","MBA Entrepreneuriat",
    // Certifications internationales
    "Certificat Google Digital Marketing","Certificat Meta Blueprint","Certificat HubSpot",
    "Certificat AWS Cloud Practitioner","Certificat AWS Solutions Architect","Certificat Azure Fundamentals",
    "Certificat Google Cloud","Certificat GCP Professional","Certificat Kubernetes (CKA)",
    "Certificat Cisco CCNA","Certificat Cisco CCNP","Certificat CompTIA Security+",
    "Certificat PMP (Project Management Professional)","Certificat Prince2","Certificat Agile Scrum",
    "Certificat Coursera (Data Science)","Certificat edX (IA & ML)","Certificat Udemy",
    "Certificat Andela","Certificat ALX Africa","Certificat Semicolon Africa",
    "Formation développeur — Andela","Formation UI/UX — Coursera","Bootcamp coding — École 237",
    "Formation numérique — Orange Digital Center","Formation — Bridge Institute","Formation — CCI Abidjan",
    // Diplômes santé / paramédical
    "Diplôme d'État d'infirmier","Diplôme d'État de sage-femme","Diplôme de technicien de laboratoire",
    "Diplôme de technicien en radiologie","Diplôme d'aide-soignant","Diplôme d'ambulancier",
    "CAP Petite Enfance","BEP Sanitaire et Social",
  ] },
  hobbies: { multi: true, items: [
    // Sports
    "Football","Basketball","Volleyball","Tennis","Rugby","Natation","Athlétisme","Cyclisme",
    "Boxe","Karaté","Judo","Taekwondo","Muay Thai","MMA","Lutte traditionnelle","Pétanque",
    "Golf","Cricket","Baseball","Handball","Badminton","Ping-pong","Squash","Escalade",
    "Surf","Kitesurf","Wakeboard","Plongée","Kayak","Aviron","Voile","Rafting",
    "Ski","Snowboard","Patinage","Equitation","Tir à l'arc","Tir sportif",
    "Course à pied","Marathon","Triathlon","CrossFit","Calisthenics","Musculation","Fitness","Yoga","Pilates","Zumba",
    "Danse (afro)","Danse (hip-hop)","Danse (salsa)","Danse (kizomba)","Danse (zouk)","Danse classique",
    // Arts & création
    "Photographie","Vidéographie","Réalisation de films","Montage vidéo","Animation 3D",
    "Dessin","Peinture (huile)","Peinture (aquarelle)","Peinture (numérique)","Sculpture","Poterie","Céramique",
    "Calligraphie","Illustration","BD / Comics","Manga","Origami","Macramé","Tricot","Crochet","Couture","Broderie",
    "Design graphique","Design intérieur","Architecture d'intérieur","Décoration","DIY / Bricolage",
    "Musique (guitare)","Musique (piano)","Musique (violon)","Musique (balafon)","Musique (djembé)",
    "Musique (kora)","Chant","Production musicale","Beatmaking","DJing","Composition",
    "Théâtre","Improvisation","Stand-up / Humour","Slam","Poésie","Storytelling","Conte africain",
    "Coiffure / Braiding","Maquillage artistique","Nail art","Stylisme","Mode","Upcycling vestimentaire",
    // Littérature & culture
    "Lecture (romans)","Lecture (développement personnel)","Lecture (sciences)","Lecture (BD / Manga)",
    "Écriture (roman)","Écriture (journal intime)","Blogging","Podcasting","Journalisme amateur",
    "Philosophie","Histoire","Archéologie","Linguistique","Généalogie","Études religieuses",
    "Cinéma","Critiques de films","Anime","K-drama","Séries TV","Jeux de société",
    // Tech & sciences
    "Programmation","Développement web","IA & Machine Learning","Robotique","Électronique",
    "Astronomie","Astrophysique","Biologie","Botanique","Mycologie","Géologie","Météorologie",
    "Impression 3D","Modélisation 3D","Domotique","Arduino / Raspberry Pi","Cybersécurité","Hacking éthique",
    "Jeux vidéo","Gaming mobile","eSports","Streaming Twitch / YouTube","Speedrun","Retro gaming",
    // Nature & voyage
    "Voyage","Randonnée","Camping","Exploration urbaine","Plein air","Observation des oiseaux",
    "Jardinage","Agriculture urbaine","Permaculture","Compostage","Apiculture","Plantes médicinales",
    "Cuisine (africaine)","Cuisine (asiatique)","Cuisine (italienne)","Pâtisserie","Boulangerie",
    "Mixologie / Cocktails","Dégustation de thé","Dégustation de café","Art du beurre de karité",
    "Bonsaï","Aquariophilie","Terrarium","Élevage (lapins, poulets, poissons)","Soins animaliers",
    // Social & communauté
    "Bénévolat","Aide communautaire","Enseignement bénévole","Encadrement de jeunes","Mentorat",
    "Entrepreneuriat","Innovation sociale","Développement durable","Activisme environnemental",
    "Investissement","Bourse & cryptomonnaies","Immobilier","Finance personnelle","Network marketing",
    "Méditation","Pleine conscience","Développement personnel","Coaching de vie","Spiritualité",
    "Religion / Foi","Chant liturgique","Choir / Chorale","Études coraniques","Catéchèse",
    "Origines & traditions africaines","Langue & dialectes","Patrimoine culturel","Masques & rituels",
    "Échecs","Dames","Scrabble","Mancala / Awalé","Poker","Backgammon","Puzzles","Sudoku","Cryptogrammes",
    "Collecte de timbres","Collecte de monnaies","Collectionneur de vinyles","Sneakers culture","Horlogerie",
    "Vélos vintage","Motos","Voitures classiques","Modélisme","Drones / FPV","Montgolfière",
  ] },
  tv: { multi: true, items: [
    // Afrique
    "Blood & Water","Country Queen","Jericho (Kenya)","Africa's Most Wanted","Shuga","Disconnect",
    "An African City","Milkah","Bino & Fino","Mama K's Team 4","Supa Team 4","Kizazi Moto",
    "King of Boys (série)","Citation (série)","Shanty Town","Far from Home","Clipped Wings",
    "Brighter Tomorrow","Jenifa's Diary","Tinsel","Super Story","Nneka the Pretty Serpent",
    // Nollywood & afro-drama
    "The Enemy Within","Voix du Sahel","Lele","On S'en Fout","Kabila ya Ngai",
    // Séries mondiales / Netflix
    "Money Heist (La Casa de Papel)","Squid Game","Stranger Things","Lupin","Emily in Paris",
    "The Crown","Bridgerton","Ozark","Narcos","Narcos Mexico","The Witcher","Wednesday",
    "Cobra Kai","Outer Banks","You","Mindhunter","Ozark","Bloodline","The OA",
    "House of Cards","Succession","Yellowstone","Yellowjackets","Euphoria","Skins",
    "Game of Thrones","House of the Dragon","The Last of Us","Rings of Power",
    "The Mandalorian","Andor","Loki","WandaVision","Moon Knight","Ms Marvel","Secret Invasion",
    "Breaking Bad","Better Call Saul","Dexter","Prison Break","Suits","Billions",
    "Peaky Blinders","Vikings","Barbarians","Spartacus","The Tudors","Rome","Marco Polo",
    "The Walking Dead","Zombie Land Saga","Fear the Walking Dead","Into the Badlands",
    "Manifest","Lost","Heroes","Limitless","Inception série","Dark (Netflix)","1899","Dark Desire",
    // Turk dizi
    "Diriliş: Ertuğrul","Diriliş Osman","Barbaroslar","Kurtuluş Osman","Kudüs Fatihi",
    "Muhteşem Yüzyıl","Fatih Harbiye","İçerde","Çukur","Ezel","Kara Para Aşk","Sen Anlat Karadeniz",
    // Anime
    "Attack on Titan","One Piece","Naruto","Naruto Shippuden","Boruto","Dragon Ball Z","Dragon Ball Super",
    "Demon Slayer","Jujutsu Kaisen","Bleach","Tokyo Ghoul","Hunter x Hunter","Death Note",
    "Fullmetal Alchemist Brotherhood","Sword Art Online","Re:Zero","That Time I Got Reincarnated",
    "My Hero Academia","Black Clover","Fairy Tail","Seven Deadly Sins","Haikyuu","Kuroko's Basketball",
    "Dr Stone","Vinland Saga","Chainsaw Man","Spy x Family","One Punch Man","Mob Psycho 100",
    // K-drama
    "Crash Landing on You","Descendants of the Sun","Goblin","Itaewon Class","Vincenzo",
    "Hellbound","All of Us Are Dead","DP","My Love from the Star","Boys Over Flowers",
    "Start-Up","Strong Girl Bong-soon","What's Wrong with Secretary Kim","Reply 1988",
    // Médical / policier / droit
    "Grey's Anatomy","House MD","The Good Doctor","Scrubs","ER","Code Black",
    "Chicago Fire","Chicago PD","Chicago Med","9-1-1","Station 19",
    "Law & Order","Criminal Minds","CSI","NCIS","Mindhunter","True Detective","Mare of Easttown",
    "Sherlock","Monk","Psych","Elementary","White Collar","Burn Notice","Suits","The Good Wife",
    // Comédie / Feel good
    "Friends","The Office (US)","Brooklyn Nine-Nine","Parks and Recreation","How I Met Your Mother",
    "Big Bang Theory","New Girl","Schitt's Creek","Ted Lasso","Abbott Elementary","Ghosts",
    "Modern Family","Fresh Prince of Bel-Air","Living Single","Martin","In Living Color",
    "Insecure","Atlanta","Issa Rae","Rap Sh!t","Abbott Elementary","Uncorked",
    // Téléréalité & divertissement
    "Love Island","Too Hot to Handle","The Circle","Survivor","Amazing Race","Big Brother",
    "Love is Blind","Indian Matchmaking","Dating Around","Ex on the Beach","Temptation Island",
    "KUWTK (Kardashian)","Real Housewives","Love & Hip Hop","Basketball Wives","P-Valley",
    "Empire","Power","Power Book","Snowfall","Queen Sugar","Greenleaf","Sistas","All American",
    "Black-ish","Mixed-ish","Grown-ish","Twenties","Run the World","Harlem","First Ladies",
  ] },
  movies: { multi: true, items: [
    // Afrique / Nollywood / cinéma africain
    "King of Boys","Merry Men","Chief Daddy","The Wedding Party","Omo Ghetto","Sugar Rush",
    "Lionheart","Isoken","Sylvia","Funmilayo Ransome-Kuti","Citation","Ile-Ife",
    "Living in Bondage","The Figurine","The Mirror Boy","October 1","Bisi Daughter of the River",
    "Yaya et Lennie","Atlantique","Bonne Mère","Mother(s)","Mères indignes",
    "Les Misérables (2019)","Banlieusards","Banlieusards 2","Sauvages","Bronx","Athena","BAC Nord",
    "La Haine","Entre les murs","Intouchables","Les Infidèles","Le Chant du Loup","Lupin le film",
    // Films africains primés
    "Timbuktu (Sissako)","Yeelen (Cissé)","Hyènes (Mambéty)","Touki Bouki","Wend Kuuni",
    "Tilai","Gainde","Quartier Mozart","Neria","Flame","Mapantsula","Zulu Love Letter",
    "Ibrahim","Bamako","Bamako (Sissako)","Daratt","Teza","Difret","Lamb (2021)",
    // Marvel / DC
    "Black Panther","Wakanda Forever","Avengers: Endgame","Avengers: Infinity War",
    "Spider-Man: No Way Home","Spider-Man: Into the Spider-Verse","Spider-Man: Across the Spider-Verse",
    "Doctor Strange","Thor","Iron Man","Captain America","Black Widow","Shang-Chi",
    "Eternals","Ms Marvel","Ant-Man","Guardians of the Galaxy","The Marvels",
    "Aquaman","Wonder Woman","Shazam","Joker","The Batman","Black Adam","Blue Beetle","The Flash",
    "Suicide Squad","Birds of Prey","Justice League","Zack Snyder's Justice League",
    // Action / Aventure
    "Fast & Furious","Fast X","The Equalizer","John Wick","Mission Impossible","Extraction",
    "Top Gun Maverick","The Gray Man","Red Notice","Bullet Train","The Lost City",
    "Mad Max Fury Road","Mad Max: Furiosa","Dune","Dune 2","The Martian","Interstellar",
    "Inception","Tenet","Oppenheimer","Dunkirk","The Dark Knight Trilogy",
    "Gladiator","Troy","300","Braveheart","Kingdom of Heaven","Hacksaw Ridge","1917",
    "The Last Samurai","RRR","Bahubali","Dangal","Lagaan","Padmaavat","Pathaan",
    // Comédie / Romance
    "Coming to America","Coming 2 America","Girls Trip","Night School","Little","Me Time",
    "The Proposal","Crazy Rich Asians","Always Be My Maybe","To All the Boys I've Loved Before",
    "Love Actually","Notting Hill","Bridget Jones","Mamma Mia","The Holiday","Hitch",
    "Dolemite Is My Name","Hustle","My Name is Dolemite","You People","Amsterdam",
    // Horreur / Thriller
    "Get Out","Us","Nope","Candyman","Haunting of Hill House","The Conjuring","Annabelle",
    "It","It Chapter Two","A Quiet Place","Hereditary","Midsommar","The Witch","His House",
    "Parasite","The Platform","Train to Busan","Peninsula","All Quiet on the Western Front",
    // Sci-fi / Fantastique
    "Avatar","Avatar: The Way of Water","Matrix Resurrections","The Matrix","Star Wars (saga)",
    "Arrival","Ex Machina","Blade Runner 2049","A.I.","Her","Minority Report","Edge of Tomorrow",
    "Lord of the Rings","The Hobbit","Harry Potter","Fantastic Beasts","Narnia","His Dark Materials",
    // Animation
    "The Lion King","Simba","Encanto","Coco","Soul","Turning Red","Raya and the Last Dragon",
    "Moana","Frozen","Brave","Mulan","Wish","Strange World","Lightyear","Elemental",
    "Spider-Man: Into the Spider-Verse","Puss in Boots 2","DreamWorks classics",
    "Spirited Away","My Neighbor Totoro","Princess Mononoke","Howl's Moving Castle","Nausicaä",
    "Akira","Ghost in the Shell","Ninja Scroll","Perfect Blue","Paprika","The Wind Rises",
    // Drame / Oscar
    "Schindler's List","The Shawshank Redemption","Forrest Gump","The Godfather","Goodfellas",
    "12 Years a Slave","Selma","Malcolm X","Ali","42","Brian Banks","Just Mercy","Judas and the Black Messiah",
    "Moonlight","If Beale Street Could Talk","Queen & Slim","The Hate U Give","Hidden Figures",
    "Green Book","BlacKkKlansman","Fences","Loving","Marshall","42","When They See Us",
    "Titanic","The Notebook","La La Land","Marriage Story","Nomadland","Everything Everywhere",
  ] },
  games: { multi: true, items: [
    // Football / Sport
    "FIFA 24 (EA Sports FC)","eFootball 2024","Winning Eleven","Pro Evolution Soccer",
    "NBA 2K24","WWE 2K24","UFC Mobile","Tennis Clash","Golf Clash","EA Sports UFC",
    "Rocket League","Madden NFL","Rugby Challenge","Cricket 24","Hockey Ultimate Team",
    // Battle royale / FPS
    "Free Fire","Free Fire MAX","PUBG Mobile","PUBG PC","Call of Duty Mobile","Call of Duty Warzone",
    "Apex Legends","Fortnite","Garena Squads","Battlegrounds Mobile India","Standoff 2",
    "Counter-Strike 2 (CS2)","Valorant","Rainbow Six Siege","Overwatch 2","Battlefield 2042",
    // Mobile legends / MOBA
    "Mobile Legends Bang Bang","Arena of Valor","League of Legends Wild Rift","Honor of Kings",
    "Dota 2","League of Legends PC","Smite","Heroes of the Storm","Pokemon Unite","Brawl Stars",
    // Stratégie / Gestion
    "Clash of Clans","Clash Royale","Boom Beach","Hay Day","Township","Farming Simulator",
    "Rise of Kingdoms","Lords Mobile","State of Survival","Last War Survival","Evony","Call of Dragons",
    "Age of Empires","Civilization VI","Total War","StarCraft","Warcraft","Command & Conquer",
    "Anno","Cities Skylines","Planet Coaster","Two Point Hospital","Football Manager","Hades",
    // Open world / RPG
    "GTA V","GTA San Andreas","GTA Online","Red Dead Redemption 2","Cyberpunk 2077",
    "Minecraft","Roblox","Terraria","Stardew Valley","Animal Crossing","Slime Rancher",
    "Elden Ring","Dark Souls III","Sekiro","Bloodborne","Lies of P","Lords of the Fallen",
    "The Witcher 3","Skyrim","Fallout 4","Mass Effect","Dragon Age","Baldur's Gate 3",
    "Genshin Impact","Honkai Star Rail","Tower of Fantasy","Blue Protocol","Wuthering Waves",
    "God of War","God of War Ragnarök","The Last of Us Part I","The Last of Us Part II",
    "Uncharted 4","Spider-Man","Spider-Man 2","Horizon Zero Dawn","Horizon Forbidden West",
    "Assassin's Creed","Ghost of Tsushima","Sekiro","Nioh","Death Stranding","Detroit Become Human",
    // Horreur / Survival
    "Resident Evil","Resident Evil Village","Silent Hill 2","Dead Space","The Forest","Sons of the Forest",
    "Subnautica","No Man's Sky","Astroneer","The Long Dark","DayZ","7 Days to Die","Green Hell",
    // Combat / Baston
    "Mortal Kombat 1","Street Fighter 6","Tekken 8","Dragon Ball FighterZ","Guilty Gear Strive",
    "Soul Calibur","King of Fighters","Injustice 2","Power Rangers Battle for the Grid","Skullgirls",
    // Course / Arcade
    "Asphalt 9","Real Racing 3","Need for Speed","Gran Turismo 7","Forza Horizon","Mario Kart",
    "Traffic Rider","Subway Surfers","Temple Run","Alto's Adventure","Hill Climb Racing",
    // Puzzle / Casual
    "Candy Crush","Wordle","Crossword","Sudoku","8 Ball Pool","Bowling King","Mini Golf King",
    "Ludo King","Carrom Pool","Okey Plus","Dominoes Gold","Scrabble Go","Words with Friends",
    "Chess.com","Lichess","Chess Tactics","Chess Clock","Royal Chess","Chess Rush",
    "Among Us","Fall Guys","Stumble Guys","Party Animals","Human Fall Flat","Gang Beasts",
    // MMO / Online
    "World of Warcraft","Final Fantasy XIV","Diablo IV","Path of Exile","Lost Ark","New World",
    "Pokémon GO","Pokémon Masters","Pokémon Scarlet & Violet","Monster Hunter Rise","Monster Hunter World",
    "Destiny 2","Warframe","Dauntless","Outriders","Anthem","BattleBit","Hell Let Loose",
  ] },
  sports: { multi: true, items: [
    // Sélections africaines (football)
    "Éléphants de Côte d'Ivoire","Lions du Sénégal","Éperviers du Togo","Écureuils du Bénin",
    "Étalons du Burkina Faso","Aigles du Mali","Syli national de Guinée","Mena du Niger",
    "Black Stars du Ghana","Super Eagles du Nigeria","Indomptables du Cameroun",
    "Pharaons d'Égypte","Lions de l'Atlas du Maroc","Fennecs d'Algérie","Aigles de Carthage de Tunisie",
    "Bafana Bafana (Afrique du Sud)","Warriors (Zimbabwe)","Chipolopolo (Zambie)","Cranes (Ouganda)",
    "Harambee Stars (Kenya)","Amavubi (Rwanda)","Taifa Stars (Tanzanie)","Walya (Éthiopie)",
    "Lions (Cameroun basket)","Nigeria basketball","Senegal basketball","Ivory Coast basket",
    // Clubs africains
    "ASEC Mimosas","Africa Sports","Stade d'Abidjan","Séwé Sports","Racing Club d'Abidjan","SOA Abidjan",
    "Zamalek SC","Al Ahly SC","Espérance Tunis","Club Africain","Étoile du Sahel","CS Sfaxien",
    "Raja Casablanca","Wydad Casablanca","FAR Rabat","FUS Rabat","AS FAR (Maroc)",
    "TP Mazembe","AS Vita Club","AS Dakar Sacré-Cœur","Generation Foot Dakar","Diambars",
    "Asante Kotoko","Hearts of Oak","Accra Lions","King Faisal","Aduana Stars",
    "Enyimba FC","Rivers United","Kano Pillars","Plateau United","Heartland FC",
    "Simba SC","Young Africans SC","Azam FC","Miembeni SC",
    "Al Hilal (Soudan)","Al Merreikh","Haras El Hodood",
    // Top 5 européens
    "Real Madrid","FC Barcelone","Atlético Madrid","Athletic Bilbao","Villarreal","Séville FC",
    "Manchester City","Manchester United","Arsenal","Liverpool","Chelsea","Tottenham","Aston Villa",
    "Newcastle","West Ham","Leicester","Everton","Crystal Palace","Brighton","Brentford",
    "PSG","Olympique de Marseille","Olympique Lyonnais","AS Monaco","LOSC Lille","OGC Nice",
    "Stade Rennais","RC Strasbourg","Montpellier HSC","Toulouse FC","FC Nantes","RC Lens",
    "Bayern Munich","Borussia Dortmund","RB Leipzig","Bayer Leverkusen","Eintracht Frankfurt",
    "Wolfsburg","Freiburg","Union Berlin","Stuttgart","Mönchengladbach","Werder Brême",
    "AC Milan","Inter Milan","Juventus","AS Roma","Naples","Lazio","Atalanta","Fiorentina","Bologna",
    "Ajax","PSV Eindhoven","Feyenoord","AZ Alkmaar","FC Utrecht","Vitesse",
    "Benfica","Porto","Sporting CP","Braga","Vitória de Guimarães",
    "Celtic","Rangers","Hearts","Aberdeen","Hibernian",
    "Galatasaray","Fenerbahçe","Beşiktaş","Trabzonspor",
    "Shakhtar Donetsk","Dynamo Kyiv","Olympiakos","PAOK","AEK Athènes",
    "Anderlecht","Club Brugge","Genk","Standard Liège",
    // Clubs d'Amérique
    "Club América","Chivas Guadalajara","Cruz Azul","Tigres UANL","Rayados de Monterrey",
    "Flamengo","Fluminense","Palmeiras","Corinthians","São Paulo FC","Santos FC","Grêmio",
    "Boca Juniors","River Plate","Independiente","Racing Club","San Lorenzo","Estudiantes",
    // NBA
    "Los Angeles Lakers","Golden State Warriors","Boston Celtics","Miami Heat","Chicago Bulls",
    "Brooklyn Nets","Milwaukee Bucks","Phoenix Suns","Denver Nuggets","Dallas Mavericks",
    "LA Clippers","Philadelphia 76ers","Oklahoma City Thunder","Memphis Grizzlies","New Orleans Pelicans",
    "Cleveland Cavaliers","Atlanta Hawks","Toronto Raptors","Minnesota Timberwolves","New York Knicks",
    // NFL
    "Kansas City Chiefs","Dallas Cowboys","New England Patriots","San Francisco 49ers","Green Bay Packers",
    "Philadelphia Eagles","Baltimore Ravens","Cincinnati Bengals","Buffalo Bills","Las Vegas Raiders",
    // Rugby
    "Springboks (Afrique du Sud)","All Blacks (Nouvelle-Zélande)","XV de France","Les Anglais","Lions britanniques",
    "Wallabies (Australie)","Pumas (Argentine)","Ireland","Scotland","Wales","Fiji","Samoa","Tonga",
    "Stade Toulousain","Racing 92","La Rochelle","Clermont","Bordeaux-Bègles","UBB","Stade Français",
    // Tennis
    "Rafael Nadal fan","Novak Djokovic fan","Carlos Alcaraz fan","Iga Swiatek fan","Jannik Sinner fan",
    "Roger Federer fan","Serena Williams fan","Daniil Medvedev fan","Casper Ruud fan","Holger Rune fan",
    // Sports individuels africains
    "Eliud Kipchoge fan","Diamond Platnumz Runners","Dina Asher-Smith fan","Usain Bolt fan",
    "Anthony Joshua fan","Francis Ngannou fan","Israel Adesanya fan","Kamaru Usman fan",
    "Hakeem Olajuwon fan","Dikembe Mutombo fan","Luka Dončić fan","Giannis fan","Victor Wembanyama fan",
    // Formule 1
    "Mercedes AMG","Red Bull Racing","Ferrari","McLaren","Aston Martin","Alpine","Williams F1",
    "Lewis Hamilton fan","Max Verstappen fan","Charles Leclerc fan","Fernando Alonso fan",
    "Lando Norris fan","George Russell fan","Carlos Sainz fan","Oscar Piastri fan",
  ] },
};

type SubView =
  | "bio" | "pinned" | "city" | "hometown" | "birthdate" | "relationship"
  | "family" | "gender" | "languages" | "experience" | "education" | "hobbies"
  | "music" | "tv" | "movies" | "games" | "sports" | "places" | "websites"
  | "social" | "phone" | "email";

/* ── Section collapse state ─────────────────────────────────────────────────── */
type SKey = "intro"|"info"|"exp"|"edu"|"loisirs"|"interests"|"voyage"|"liens"|"coords";

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function EditProfilePage() {
  const navigate = useNavigate();

  const rawUser = localStorage.getItem("fb_user");
  const localUser: { name: string; email: string; phone?: string; country?: string; bio?: string } =
    rawUser ? JSON.parse(rawUser) : { name: "", email: "" };

  const [bio,   setBio]   = useState(localUser.bio ?? "");
  const [city,  setCity]  = useState(localUser.country ?? "");
  const [phone, setPhone] = useState(localUser.phone ?? "");
  const [ext,   setExt]   = useState<ExtProfile>(loadExt);
  const [saving, setSaving] = useState(false);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [familyStep, setFamilyStep] = useState<1|2>(1);
  const [familyPick, setFamilyPick] = useState<PublicUser | null>(null);
  const [familySearch, setFamilySearch] = useState("");

  const [open, setOpen] = useState<Record<SKey, boolean>>({
    intro: true, info: true, exp: true, edu: true, loisirs: true,
    interests: true, voyage: true, liens: true, coords: true,
  });
  const [view, setView] = useState<SubView | null>(null);

  /* Temp values for each sub-view */
  const [tmp, setTmp] = useState("");
  const [tmpPrivacy, setTmpPrivacy] = useState<"public"|"friends"|"only_me">("friends");
  const [tmpPhones, setTmpPhones]   = useState<string[]>([]);

  /* Refresh from API */
  useEffect(() => {
    apiGetMe().then(u => {
      saveFbUser(u);
      setBio(u.bio ?? "");
      setCity(u.country ?? "");
      setPhone(u.phone ?? "");
    }).catch(() => {});
  }, []);

  /* Load friends when family view opens */
  useEffect(() => {
    if (view === "family" && friends.length === 0) {
      apiGetFriends()
        .then(data => {
          if (data.length > 0) { setFriends(data); return; }
          // fallback: all users (minus current user)
          const rawMe = localStorage.getItem("fb_user");
          const meId: number = rawMe ? (JSON.parse(rawMe) as { id?: number }).id ?? -1 : -1;
          import("../lib/api").then(({ apiGetUsers }) =>
            apiGetUsers().then(all => setFriends(all.filter(u => u.id !== meId)))
          ).catch(() => {});
        })
        .catch(() => {});
    }
  }, [view]);

  /* ── Section toggle ─────────────────────────────────────────────────────── */
  const toggleSection = (k: SKey) => setOpen(o => ({ ...o, [k]: !o[k] }));

  /* ── Open sub-view ─────────────────────────────────────────────────────── */
  const openView = (v: SubView) => {
    setView(v);
    if (v === "bio")         { setTmp(bio); }
    else if (v === "city")   { setTmp(city); }
    else if (v === "hometown")    { setTmp(ext.hometown); }
    else if (v === "birthdate")   { setTmpPrivacy(ext.birthPrivacy); }
    else if (v === "relationship") { setTmp(ext.relationship); }
    else if (v === "family")      { setTmp(ext.family); setFamilyStep(1); setFamilyPick(null); setFamilySearch(""); }
    else if (v === "gender")      { setTmp(ext.gender); setTmpPrivacy(ext.genderPrivacy); }
    else if (v === "languages")   { setTmp(ext.languages); }
    else if (v === "experience")  { setTmp(ext.experience); }
    else if (v === "education")   { setTmp(ext.education); }
    else if (v === "hobbies")     { setTmp(ext.hobbies); }
    else if (v === "music")       { setTmp(ext.interestMusic); }
    else if (v === "tv")          { setTmp(ext.interestTv); }
    else if (v === "movies")      { setTmp(ext.interestMovies); }
    else if (v === "games")       { setTmp(ext.interestGames); }
    else if (v === "sports")      { setTmp(ext.interestSports); }
    else if (v === "places")      { setTmp(ext.travelPlaces); }
    else if (v === "websites")    { setTmp(ext.websites); }
    else if (v === "social")      { setTmp(ext.socialLinks); }
    else if (v === "phone")       { setTmpPhones([phone, ...ext.extraPhones]); }
    else if (v === "email")       { setTmp(localUser.email); }
  };

  /* ── Save sub-view ─────────────────────────────────────────────────────── */
  const saveView = async () => {
    setSaving(true);
    try {
      if (view === "bio") {
        setBio(tmp);
        const updated = await apiUpdateMe({ bio: tmp });
        saveFbUser(updated);
      } else if (view === "city") {
        setCity(tmp);
        const updated = await apiUpdateMe({ country: tmp });
        saveFbUser(updated);
      } else if (view === "hometown") {
        const e = { ...ext, hometown: tmp }; setExt(e); saveExt(e);
      } else if (view === "birthdate") {
        const e = { ...ext, birthPrivacy: tmpPrivacy }; setExt(e); saveExt(e);
      } else if (view === "relationship") {
        const e = { ...ext, relationship: tmp }; setExt(e); saveExt(e);
      } else if (view === "family") {
        const e = { ...ext, family: tmp }; setExt(e); saveExt(e);
      } else if (view === "gender") {
        const e = { ...ext, gender: tmp, genderPrivacy: tmpPrivacy }; setExt(e); saveExt(e);
      } else if (view === "languages") {
        const e = { ...ext, languages: tmp }; setExt(e); saveExt(e);
      } else if (view === "experience") {
        const e = { ...ext, experience: tmp }; setExt(e); saveExt(e);
      } else if (view === "education") {
        const e = { ...ext, education: tmp }; setExt(e); saveExt(e);
      } else if (view === "hobbies") {
        const e = { ...ext, hobbies: tmp }; setExt(e); saveExt(e);
      } else if (view === "music")   { const e = { ...ext, interestMusic: tmp }; setExt(e); saveExt(e); }
      else if (view === "tv")        { const e = { ...ext, interestTv: tmp }; setExt(e); saveExt(e); }
      else if (view === "movies")    { const e = { ...ext, interestMovies: tmp }; setExt(e); saveExt(e); }
      else if (view === "games")     { const e = { ...ext, interestGames: tmp }; setExt(e); saveExt(e); }
      else if (view === "sports")    { const e = { ...ext, interestSports: tmp }; setExt(e); saveExt(e); }
      else if (view === "places")    { const e = { ...ext, travelPlaces: tmp }; setExt(e); saveExt(e); }
      else if (view === "websites")  { const e = { ...ext, websites: tmp }; setExt(e); saveExt(e); }
      else if (view === "social")    { const e = { ...ext, socialLinks: tmp }; setExt(e); saveExt(e); }
      else if (view === "phone") {
        const [main, ...extras] = tmpPhones.filter(p => p.trim());
        setPhone(main ?? "");
        const e = { ...ext, extraPhones: extras }; setExt(e); saveExt(e);
        if (main) { const updated = await apiUpdateMe({ phone: main }); saveFbUser(updated); }
      }
    } catch { /* silent — data saved locally */ }
    setSaving(false);
    setView(null);
  };

  /* ── Birth date formatting ───────────────────────────────────────────────── */
  const birthLabel = (() => {
    const { birthDay, birthMonth, birthYear } = ext;
    if (!birthDay && !birthMonth && !birthYear) return null;
    const parts = [];
    if (birthDay && birthMonth) parts.push(`${birthDay} ${MONTHS[parseInt(birthMonth) - 1] ?? ""}`);
    if (birthYear) parts.push(birthYear);
    return parts.join(" · ");
  })();

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* SUB-VIEWS                                                                  */
  /* ══════════════════════════════════════════════════════════════════════════ */

  if (view === "bio") {
    const MAX = 101;
    const canSave = tmp.trim().length > 0;
    return (
      <SubPage title="Intro" onClose={() => setView(null)}>
        <div style={{ padding: "20px 16px" }}>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Ajoutez une bio</div>
          <div style={{ color: "var(--fb-text-secondary)", fontSize: 14, marginBottom: 16 }}>Présentez-vous</div>
          <textarea
            value={tmp}
            onChange={e => setTmp(e.target.value.slice(0, MAX))}
            autoFocus
            style={{ width: "100%", minHeight: 100, border: "1px solid var(--fb-divider)", borderRadius: 8, padding: "12px 14px", fontSize: 15, resize: "none", outline: "none", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <span>🌐 Public</span>
            <span>·</span>
            <span>{tmp.length}/{MAX}</span>
          </div>
          <button
            onClick={saveView}
            disabled={!canSave || saving}
            style={{ width: "100%", marginTop: 20, padding: "13px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 15, cursor: canSave ? "pointer" : "not-allowed", background: canSave ? "var(--fb-blue)" : "var(--fb-bg)", color: canSave ? "#fff" : "var(--fb-text-secondary)", transition: "all 0.2s" }}
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </SubPage>
    );
  }

  if (view === "birthdate") {
    return (
      <SubPage title="Date de naissance" onClose={() => setView(null)}>
        <div style={{ padding: "20px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Date de naissance</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 8, marginBottom: 16 }}>
            <input value={ext.birthDay} onChange={e => setExt(p => { const n = { ...p, birthDay: e.target.value }; saveExt(n); return n; })}
              placeholder="Jour" type="number" min={1} max={31}
              style={inputStyle} />
            <select value={ext.birthMonth} onChange={e => setExt(p => { const n = { ...p, birthMonth: e.target.value }; saveExt(n); return n; })}
              style={inputStyle}>
              <option value="">Mois</option>
              {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
            </select>
            <input value={ext.birthYear} onChange={e => setExt(p => { const n = { ...p, birthYear: e.target.value }; saveExt(n); return n; })}
              placeholder="Année" type="number" min={1900} max={new Date().getFullYear()}
              style={inputStyle} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Qui peut voir ça ?</div>
          <PrivacyPicker value={tmpPrivacy} onChange={setTmpPrivacy} />
          <button onClick={saveView} disabled={saving} style={saveBtnStyle}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </SubPage>
    );
  }

  if (view === "gender") {
    const GENDERS = ["Homme","Femme","Non-binaire","Autre"];
    return (
      <SubPage title="Genre" onClose={() => setView(null)}>
        <div style={{ padding: "20px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Genre</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {GENDERS.map(g => (
              <label key={g} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: tmp === g ? "var(--fb-blue-light)" : "var(--fb-bg)", border: tmp === g ? "2px solid var(--fb-blue)" : "2px solid transparent", cursor: "pointer" }}>
                <input type="radio" name="gender" value={g} checked={tmp === g} onChange={() => setTmp(g)} style={{ accentColor: "var(--fb-blue)" }} />
                <span style={{ fontWeight: tmp === g ? 700 : 400 }}>{g}</span>
              </label>
            ))}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Qui peut voir ça ?</div>
          <PrivacyPicker value={tmpPrivacy} onChange={setTmpPrivacy} />
          <button onClick={saveView} disabled={saving} style={saveBtnStyle}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </SubPage>
    );
  }

  if (view === "phone") {
    return (
      <SubPage title="Téléphone" onClose={() => setView(null)}>
        <div style={{ padding: "20px 16px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Numéros de téléphone</div>
          {tmpPhones.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                value={p}
                onChange={e => setTmpPhones(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                placeholder="Ex : +225 0123456789"
                style={{ ...inputStyle, flex: 1 }}
              />
              {tmpPhones.length > 1 && (
                <button onClick={() => setTmpPhones(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: "#FFEBEE", border: "none", color: "#c62828", borderRadius: 8, padding: "0 12px", cursor: "pointer", fontSize: 16 }}>✕</button>
              )}
            </div>
          ))}
          <button onClick={() => setTmpPhones(p => [...p, ""])}
            style={{ background: "none", border: "1px dashed var(--fb-divider)", borderRadius: 10, padding: "10px 16px", cursor: "pointer", color: "var(--fb-blue)", fontWeight: 700, width: "100%", marginBottom: 20 }}>
            + Ajouter un numéro
          </button>
          <button onClick={saveView} disabled={saving} style={saveBtnStyle}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </SubPage>
    );
  }

  if (view === "family") {
    const RELATIONS = [
      "Père","Mère","Fils","Fille","Frère","Sœur",
      "Mari","Femme","Petit ami","Petite amie",
      "Cousin","Cousine","Oncle","Tante",
      "Grand-père","Grand-mère","Neveu","Nièce",
      "Beau-père","Belle-mère","Ami(e) proche",
    ];

    /* ── Étape 1 : choisir l'ami ─────────────────────────────────────── */
    if (familyStep === 1) {
      const q = familySearch.trim().toLowerCase();
      const list = friends.filter(f =>
        !q || `${f.firstName} ${f.lastName}`.toLowerCase().includes(q)
      );
      return (
        <SubPage
          title="Choisir un ami"
          onClose={() => setView(null)}
          backLabel={tmp ? "‹ Annuler" : undefined}
          onBack={tmp ? () => setView(null) : undefined}
        >
          {/* Search */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)" }}>
            <input
              value={familySearch}
              onChange={e => setFamilySearch(e.target.value)}
              placeholder="Rechercher un ami…"
              autoFocus
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
            />
          </div>
          {/* Friend list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {list.length === 0 && (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--fb-text-secondary)", fontSize: 14 }}>
                {friends.length === 0 ? "Chargement…" : "Aucun résultat"}
              </div>
            )}
            {list.map(f => {
              const fullName = `${f.firstName} ${f.lastName}`;
              const initials = (f.firstName[0] ?? "") + (f.lastName[0] ?? "");
              return (
                <button key={f.id} type="button"
                  onClick={() => { setFamilyPick(f); setFamilyStep(2); }}
                  style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "13px 16px", background: "none", border: "none", borderBottom: "1px solid var(--fb-divider)", cursor: "pointer", textAlign: "left" }}>
                  {f.avatarUrl ? (
                    <img src={f.avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--fb-blue)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
                      {initials}
                    </div>
                  )}
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--fb-text)" }}>{fullName}</span>
                </button>
              );
            })}
          </div>
        </SubPage>
      );
    }

    /* ── Étape 2 : choisir le lien de parenté ───────────────────────── */
    const f = familyPick!;
    const fullName = `${f.firstName} ${f.lastName}`;
    const initials  = (f.firstName[0] ?? "") + (f.lastName[0] ?? "");
    return (
      <SubPage
        title="Quel lien ?"
        onClose={() => setView(null)}
        backLabel="‹ Retour"
        onBack={() => setFamilyStep(1)}
      >
        {/* Selected friend header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 16px 12px", borderBottom: "1px solid var(--fb-divider)", background: "var(--fb-bg)" }}>
          {f.avatarUrl ? (
            <img src={f.avatarUrl} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--fb-blue)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 800, flexShrink: 0 }}>
              {initials}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{fullName}</div>
            <div style={{ fontSize: 13, color: "var(--fb-text-secondary)" }}>Sélectionner le lien de parenté</div>
          </div>
        </div>
        {/* Relation options */}
        <div style={{ padding: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {RELATIONS.map(rel => (
              <button key={rel} type="button"
                onClick={async () => {
                  const entry = `${fullName} (${rel})`;
                  const existing = ext.family.trim();
                  const newVal = existing ? `${existing}, ${entry}` : entry;
                  const e = { ...ext, family: newVal }; setExt(e); saveExt(e);
                  setSaving(true);
                  try { /* family stays localStorage only */ } catch { /* ignore */ }
                  setSaving(false);
                  setView(null);
                }}
                style={{ padding: "14px 10px", borderRadius: 12, border: "1.5px solid var(--fb-divider)", background: "var(--fb-bg)", fontSize: 15, fontWeight: 600, cursor: "pointer", color: "var(--fb-text)", textAlign: "center", transition: "background 0.15s, border-color 0.15s" }}>
                {rel}
              </button>
            ))}
          </div>
        </div>
      </SubPage>
    );
  }

  /* Generic single-field sub-views */
  if (view !== null) {
    const META: Record<SubView, { title: string; placeholder: string; multiline?: boolean }> = {
      bio: { title: "Bio", placeholder: "" },
      pinned: { title: "Détails épinglés", placeholder: "Ex : Abomey-Calavi, Bénin" },
      city:   { title: "Ville actuelle", placeholder: "Ex : Abidjan, Dakar…" },
      hometown: { title: "Ville d'origine", placeholder: "Ex : Cotonou, Bouaké…" },
      birthdate: { title: "Date de naissance", placeholder: "" },
      relationship: { title: "Situation amoureuse", placeholder: "Ex : En couple, Célibataire…" },
      family: { title: "Famille", placeholder: "Ex : Père de 2 enfants" },
      gender: { title: "Genre", placeholder: "" },
      languages: { title: "Langues", placeholder: "Ex : Français, Yoruba, Anglais" },
      experience: { title: "Expérience professionnelle", placeholder: "Ex : Développeur chez TechAfrica (2022–…)" },
      education: { title: "Formation", placeholder: "Ex : Licence Informatique — UAC 2020" },
      hobbies: { title: "Passe-temps", placeholder: "Ex : Football, photographie, cuisine" },
      music: { title: "Musique", placeholder: "Ex : Afrobeats, Coupé-Décalé, RnB" },
      tv: { title: "Séries télé", placeholder: "Ex : Money Heist, Squid Game" },
      movies: { title: "Films", placeholder: "Ex : Black Panther, Parasite" },
      games: { title: "Jeux", placeholder: "Ex : FIFA, Clash of Clans" },
      sports: { title: "Équipes sportives", placeholder: "Ex : OM, Real Madrid, Éléphants de CI" },
      places: { title: "Lieux visités", placeholder: "Ex : Paris, Dakar, Dubaï" },
      websites: { title: "Sites Web / Blogs", placeholder: "Ex : https://monsite.com" },
      social: { title: "Réseaux sociaux", placeholder: "Ex : @monpseudo sur Instagram, Twitter…" },
      phone: { title: "Téléphone", placeholder: "" },
      email: { title: "E-mail", placeholder: "" },
    };
    const meta = META[view];
    const sugg = SUGGESTIONS[view];
    return (
      <SubPage title={meta.title} onClose={() => setView(null)}>
        <div style={{ padding: "20px 16px" }}>
          {meta.multiline ? (
            <textarea value={tmp} onChange={e => setTmp(e.target.value)} placeholder={meta.placeholder} autoFocus
              style={{ width: "100%", minHeight: 100, border: "1px solid var(--fb-divider)", borderRadius: 8, padding: "12px 14px", fontSize: 15, resize: "none", outline: "none", boxSizing: "border-box" }} />
          ) : (
            <input value={tmp} onChange={e => setTmp(e.target.value)} placeholder={meta.placeholder} autoFocus
              style={{ ...inputStyle, width: "100%" }} />
          )}
          {sugg && (
            <SuggestionChips
              items={sugg.items}
              value={tmp}
              multi={sugg.multi}
              onSelect={s => {
                if (sugg.multi) {
                  setTmp(prev => {
                    const parts = prev.split(",").map(p => p.trim()).filter(Boolean);
                    if (parts.map(p => p.toLowerCase()).includes(s.toLowerCase())) return prev;
                    return parts.length > 0 ? parts.join(", ") + ", " + s : s;
                  });
                } else {
                  setTmp(s);
                }
              }}
            />
          )}
          <button onClick={saveView} disabled={saving || !tmp.trim()} style={{ ...saveBtnStyle, opacity: tmp.trim() ? 1 : 0.5, marginTop: sugg ? 16 : 24 }}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </SubPage>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════ */
  /* MAIN LIST                                                                  */
  /* ══════════════════════════════════════════════════════════════════════════ */

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", paddingBottom: 40, background: "var(--fb-white)", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", position: "sticky", top: 0, background: "var(--fb-white)", zIndex: 10 }}>
        <button onClick={() => navigate("/profile")} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--fb-blue)", padding: "4px 10px 4px 0" }}>‹</button>
        <span style={{ fontWeight: 800, fontSize: 17, flex: 1, textAlign: "center", marginRight: 34 }}>Modifier le profil</span>
      </div>

      {/* ── INTRO ── */}
      <SectionHeader label="Intro" open={open.intro} onToggle={() => toggleSection("intro")} />
      {open.intro && (
        <>
          <Row icon="👋" label="À propos de vous" value={bio || null} onEdit={() => openView("bio")} />
          <Row icon="📌" label="Détails épinglés" value={ext.hometown || city || null} onEdit={() => openView("pinned")} />
        </>
      )}

      {/* ── INFORMATIONS PERSONNELLES ── */}
      <SectionHeader label="Informations personnelles" open={open.info} onToggle={() => toggleSection("info")} />
      {open.info && (
        <>
          <Row icon="📍" label={city || "Ville actuelle"} value={city ? "🌐 Public" : null} onEdit={() => openView("city")} dimLabel={!city} />
          <Row icon="🏠" label={ext.hometown || "Ville d'origine"} value={null} onEdit={() => openView("hometown")} dimLabel={!ext.hometown} />
          <Row icon="🎂" label={birthLabel ?? "Date de naissance"} value={birthLabel ? `${PRIVACY_ICON[ext.birthPrivacy]} ${PRIVACY_LABEL[ext.birthPrivacy]}` : null} onEdit={() => openView("birthdate")} dimLabel={!birthLabel} />
          <Row icon="❤️" label={ext.relationship || "Situation amoureuse"} value={null} onEdit={() => openView("relationship")} dimLabel={!ext.relationship} />
          <Row icon="🌳" label={ext.family || "Famille"} value={null} onEdit={() => openView("family")} dimLabel={!ext.family} />
          <Row icon="⚥" label={ext.gender || "Genre"} value={ext.gender ? `${PRIVACY_ICON[ext.genderPrivacy]} ${PRIVACY_LABEL[ext.genderPrivacy]}` : null} onEdit={() => openView("gender")} dimLabel={!ext.gender} />
          <Row icon="🗣️" label={ext.languages || "Langues"} value={null} onEdit={() => openView("languages")} dimLabel={!ext.languages} />
        </>
      )}

      {/* ── EXPÉRIENCES PRO ── */}
      <SectionHeader label="Expériences professionnelles" open={open.exp} onToggle={() => toggleSection("exp")} />
      {open.exp && (
        <Row icon="💼" label={ext.experience || "Expérience professionnelle"} value={null} onEdit={() => openView("experience")} dimLabel={!ext.experience} />
      )}

      {/* ── FORMATION ── */}
      <SectionHeader label="Formation" open={open.edu} onToggle={() => toggleSection("edu")} />
      {open.edu && (
        <Row icon="🏫" label={ext.education || "Lycée ou université"} value={null} onEdit={() => openView("education")} dimLabel={!ext.education} />
      )}

      {/* ── LOISIRS ── */}
      <SectionHeader label="Loisirs" open={open.loisirs} onToggle={() => toggleSection("loisirs")} />
      {open.loisirs && (
        <Row icon="🎮" label={ext.hobbies || "Passe-temps"} value={null} onEdit={() => openView("hobbies")} dimLabel={!ext.hobbies} />
      )}

      {/* ── CENTRES D'INTÉRÊT ── */}
      <SectionHeader label="Centres d'intérêt" open={open.interests} onToggle={() => toggleSection("interests")} />
      {open.interests && (
        <>
          <Row icon="🎵" label={ext.interestMusic || "Musique"} value={null} onEdit={() => openView("music")} dimLabel={!ext.interestMusic} />
          <Row icon="📺" label={ext.interestTv || "Séries télé"} value={null} onEdit={() => openView("tv")} dimLabel={!ext.interestTv} />
          <Row icon="🎬" label={ext.interestMovies || "Films"} value={null} onEdit={() => openView("movies")} dimLabel={!ext.interestMovies} />
          <Row icon="🕹️" label={ext.interestGames || "Jeux"} value={null} onEdit={() => openView("games")} dimLabel={!ext.interestGames} />
          <Row icon="👕" label={ext.interestSports || "Équipes sportives et athlètes"} value={null} onEdit={() => openView("sports")} dimLabel={!ext.interestSports} />
        </>
      )}

      {/* ── VOYAGE ── */}
      <SectionHeader label="Voyage" open={open.voyage} onToggle={() => toggleSection("voyage")} />
      {open.voyage && (
        <Row icon="✈️" label={ext.travelPlaces || "Lieux"} value={null} onEdit={() => openView("places")} dimLabel={!ext.travelPlaces} />
      )}

      {/* ── LIENS ── */}
      <SectionHeader label="Liens" open={open.liens} onToggle={() => toggleSection("liens")} />
      {open.liens && (
        <Row icon="🔗" label={ext.websites || "Sites Web, blogs, portfolios"} value={null} onEdit={() => openView("websites")} dimLabel={!ext.websites} />
      )}

      {/* ── COORDONNÉES ── */}
      <SectionHeader label="Coordonnées" open={open.coords} onToggle={() => toggleSection("coords")} />
      {open.coords && (
        <>
          <Row icon="@" label={ext.socialLinks || "Réseaux sociaux"} value={null} onEdit={() => openView("social")} dimLabel={!ext.socialLinks} />
          {phone && (
            <Row icon="📞" label={phone} value={`🔒 Moi uniquement`} onEdit={() => openView("phone")} />
          )}
          {ext.extraPhones.filter(p => p.trim()).map((p, i) => (
            <Row key={i} icon="📞" label={p} value="🔒 Moi uniquement" onEdit={() => openView("phone")} />
          ))}
          {!phone && (
            <Row icon="📞" label="Ajouter un numéro de téléphone" value={null} onEdit={() => openView("phone")} dimLabel />
          )}
          <Row icon="✉️" label={localUser.email || "Ajouter une adresse e-mail"} value={localUser.email ? "🔒 Moi uniquement" : null} onEdit={() => openView("email")} dimLabel={!localUser.email} />
        </>
      )}

      {/* ── STOCKAGE ── */}
      <div style={{ borderTop: "8px solid var(--fb-bg, #f0f2f5)", marginTop: 8 }}>
        <div style={{
          padding: "12px 16px 4px",
          fontWeight: 800, fontSize: 14,
          color: "var(--fb-text-secondary)",
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}>
          Stockage
        </div>
        <StorageSection />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════════════════════ */

function SubPage({ title, onClose, onBack, backLabel, children }: {
  title: string; onClose: () => void;
  onBack?: () => void; backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--fb-white)", zIndex: 50, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--fb-divider)", gap: 6 }}>
        {onBack ? (
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "var(--fb-blue)", padding: "4px 8px 4px 0", whiteSpace: "nowrap" }}>
            {backLabel ?? "‹ Retour"}
          </button>
        ) : (
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--fb-text)", lineHeight: 1, padding: "4px 10px 4px 0" }}>✕</button>
        )}
        <span style={{ fontWeight: 800, fontSize: 17, flex: 1, textAlign: "center" }}>{title}</span>
        {onBack && (
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--fb-text)", padding: "4px 0 4px 8px" }}>✕</button>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
    </div>
  );
}

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer", borderTop: "6px solid var(--fb-bg)" }}>
      <span style={{ fontWeight: 900, fontSize: 16 }}>{label}</span>
      <span style={{ fontSize: 18, color: "var(--fb-text-secondary)" }}>{open ? "∧" : "∨"}</span>
    </div>
  );
}

function Row({ icon, label, value, onEdit, dimLabel }: {
  icon: string; label: string; value: string | null; onEdit: () => void; dimLabel?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: "1px solid var(--fb-divider)", cursor: "pointer" }} onClick={onEdit}>
      <span style={{ fontSize: 20, width: 28, textAlign: "center", flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: value ? 700 : 400, color: dimLabel ? "var(--fb-text-secondary)" : "var(--fb-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </div>
        {value && (
          <div style={{ fontSize: 12, color: "var(--fb-text-secondary)", marginTop: 1 }}>{value}</div>
        )}
      </div>
      {value && (
        <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--fb-text-secondary)", padding: "4px 6px" }}>✏️</button>
      )}
    </div>
  );
}

function PrivacyPicker({ value, onChange }: { value: "public"|"friends"|"only_me"; onChange: (v: "public"|"friends"|"only_me") => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
      {PRIVACY_OPTS.map(opt => (
        <label key={opt} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: value === opt ? "var(--fb-blue-light)" : "var(--fb-bg)", border: value === opt ? "2px solid var(--fb-blue)" : "2px solid transparent", cursor: "pointer" }}>
          <input type="radio" name="privacy" value={opt} checked={value === opt} onChange={() => onChange(opt)} style={{ accentColor: "var(--fb-blue)" }} />
          <span>{PRIVACY_ICON[opt]}</span>
          <span style={{ fontWeight: value === opt ? 700 : 400 }}>{PRIVACY_LABEL[opt]}</span>
        </label>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--fb-bg)", border: "1px solid var(--fb-divider)",
  borderRadius: 8, padding: "12px 14px", fontSize: 15, outline: "none",
  width: "100%", boxSizing: "border-box",
};

const saveBtnStyle: React.CSSProperties = {
  width: "100%", marginTop: 24, padding: "13px", borderRadius: 10, border: "none",
  fontWeight: 800, fontSize: 15, cursor: "pointer",
  background: "var(--fb-blue)", color: "#fff",
};

function SuggestionChips({ items, value, multi, onSelect }: {
  items: string[];
  value: string;
  multi?: boolean;
  onSelect: (s: string) => void;
}) {
  const selected = new Set(
    value.split(",").map(p => p.trim().toLowerCase()).filter(Boolean)
  );
  const query = multi
    ? (value.split(",").pop() ?? "").trim().toLowerCase()
    : value.trim().toLowerCase();

  const isSearching = query.length > 0;

  const filtered = items.filter(item => {
    if (multi && selected.has(item.toLowerCase())) return false;
    if (!isSearching) return true;
    return item.toLowerCase().includes(query);
  });

  // At rest: show first 10; when typing: show all matches (no cap)
  const visible = isSearching ? filtered : filtered.slice(0, 10);

  if (visible.length === 0) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, color: isSearching ? "var(--fb-blue)" : "var(--fb-text-secondary)", marginBottom: 8, fontWeight: 600 }}>
        {isSearching ? `${visible.length} résultat${visible.length > 1 ? "s" : ""}` : "Suggestions"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {visible.map((item, i) => (
          <button
            key={`${i}-${item}`}
            type="button"
            onMouseDown={e => { e.preventDefault(); onSelect(item); }}
            style={{
              background: isSearching ? "var(--fb-blue-light, #e7f0fd)" : "var(--fb-bg)",
              border: `1.5px solid ${isSearching ? "var(--fb-blue)" : "var(--fb-divider)"}`,
              borderRadius: 20, padding: "6px 14px", fontSize: 14,
              cursor: "pointer",
              color: isSearching ? "var(--fb-blue)" : "var(--fb-text)",
              whiteSpace: "nowrap", fontWeight: isSearching ? 700 : 500,
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
