/* ===========================
   BILINGUAL SUPPORT (EN / FR)
   ===========================

   How it works:
   - Every translatable element in index.html has a data-i18n="key" attribute.
   - This file maps each key to its English and French text.
   - setLanguage() swaps the text of every tagged element and saves the
     choice in localStorage so it sticks on the next visit.

   To add a new translatable string:
   1. Add data-i18n="some.key" to the element in index.html
   2. Add "some.key" to BOTH the en and fr objects below
*/

const translations = {
    en: {
        /* Navbar */
        "nav.home": "Home",
        "nav.services": "Services",
        "nav.portfolio": "Portfolio",
        "nav.about": "About",
        "nav.contact": "Contact",
        "nav.quote": "Get Quote",

        /* Hero */
        "hero.title": "Masterful Woodwork",
        "hero.subtitle": "Timeless Designs from African Heritage",
        "hero.description": "Expert carpentry, custom chairs, stunning roofing, and bespoke furniture crafted with passion",
        "hero.btnPortfolio": "Explore Portfolio",
        "hero.btnQuote": "Get Quote",

        /* Services */
        "services.title": "Our Services",
        "services.subtitle": "Comprehensive carpentry solutions tailored to your needs",
        "service.chairs.title": "Custom Chairs & Seating",
        "service.chairs.desc": "Handcrafted chairs with traditional African designs and modern comfort. Each piece is unique and built to last generations.",
        "service.roofing.title": "House Roofing",
        "service.roofing.desc": "Professional roofing solutions using premium materials and traditional African architectural styles. Weather-resistant and stunning.",
        "service.interior.title": "Interior Furniture",
        "service.interior.desc": "Complete interior design with custom-made furniture. Blend traditional African aesthetics with contemporary living.",
        "service.doors.title": "Doors & Frames",
        "service.doors.desc": "Intricate wooden doors and frames with traditional African patterns. Each design tells a story of craftsmanship.",
        "service.custom.title": "Custom Carpentry",
        "service.custom.desc": "Bespoke carpentry work for any project. From design consultation to final installation, we handle it all.",
        "service.restoration.title": "Restoration & Refinishing",
        "service.restoration.desc": "Restore and refinish your precious wooden pieces. We preserve the beauty of heritage furniture.",

        /* Portfolio */
        "portfolio.title": "Our Portfolio",
        "portfolio.subtitle": "Showcase of our finest carpentry work",
        "portfolio.tab.all": "All Works",
        "portfolio.tab.chairs": "Chairs",
        "portfolio.tab.roofing": "Roofing",
        "portfolio.tab.furniture": "Furniture",
        "pf.chair1.title": "Savanna Walnut Dining Set",
        "pf.chair1.desc": "Solid-walnut four-seater with cushioned linen seats and tapered legs",
        "pf.chair2.title": "Modern Comfort Lounge Chair",
        "pf.chair2.desc": "Sculpted walnut frame with a deep upholstered seat for all-day comfort",
        "pf.chair3.title": "Black leather furniture set",
        "pf.chair3.desc": "Hand-carved statement seating with intricate traditional motifs",
        "pf.chair4.title": "A modern chaise lounge",
        "pf.chair4.desc": "A sleek beige chaise lounge with natural wooden legs, blending modern comfort and timeless elegance in one inviting piece",
        "pf.roof1.title": "Timber Truss / Wooden Rafter Structure",
        "pf.roof1.desc": "This roofing project demonstrates the full progression of a two-story building's roof installation",
        "pf.roof2.title": "Pitched Gable Roof",
        "pf.roof2.desc": "This roof features a single-floor pitched gable design built with timber trusses and finished with durable zinc sheets for strength, ventilation, and weather resistance.",
        "pf.roof3.title": "Modern African Roofing",
        "pf.roof3.desc": "Hybrid design blending heritage form with contemporary materials",
        "pf.furn1.title": "African Dining Set",
        "pf.furn1.desc": "Complete walnut dining table with matching upholstered seating",
        "pf.furn2.title": "Artisan Coffee Table",
        "pf.furn2.desc": "Decorative low table with hand-carved traditional detailing",
        "pf.furn3.title": "Bedroom Suite",
        "pf.furn3.desc": "Coordinated bedroom collection in warm solid hardwood",
        "pf.furn4.title": "Heritage Storage Cabinet",
        "pf.furn4.desc": "Handcrafted cabinet with carved decorative door panels",

        /* About */
        "about.title": "About LouisBudgetDesign",
        "about.welcome": "Welcome to LouisBudgetDesign",
        "about.intro": "With over 20 years of experience in traditional African carpentry, we bring heritage and innovation together. Our artisans are trained in time-honored techniques while embracing modern design principles.",
        "about.feature.quality.title": "Quality Craftsmanship",
        "about.feature.quality.desc": "Every piece is handcrafted with attention to detail",
        "about.feature.materials.title": "Sustainable Materials",
        "about.feature.materials.desc": "We use responsibly sourced African timber",
        "about.feature.custom.title": "Custom Designs",
        "about.feature.custom.desc": "Unique pieces tailored to your vision",
        "about.stat.projects": "Projects Completed",
        "about.stat.years": "Years Experience",
        "about.stat.satisfaction": "Client Satisfaction",

        /* Testimonials */
        "testimonials.title": "What Our Clients Say",
        "testimonials.subtitle": "Hear from satisfied customers about their experience with TimberCraft",
        "testimonial.1.text": "\"The chairs we ordered are absolutely stunning! The craftsmanship is impeccable and the attention to detail is remarkable. Highly recommended!\"",
        "testimonial.2.text": "\"Our roof renovation was handled with professionalism. The team understood our vision and delivered beyond expectations. Worth every penny!\"",
        "testimonial.3.text": "\"TimberCraft transformed our home with beautiful furniture and doors. The team's expertise in African design is evident in every piece.\"",

        /* Contact */
        "contact.title": "Get In Touch",
        "contact.subtitle": "Ready to start your carpentry project? Contact us today!",
        "contact.address": "Address",
        "contact.phone": "Phone",
        "contact.email": "Email",
        "contact.hours": "Hours",
        "contact.hours.value": "Mon - Fri: 8:00 AM - 6:00 PM<br>Sat: 9:00 AM - 4:00 PM",
        "form.name": "Your Name",
        "form.email": "Your Email",
        "form.phone": "Your Phone",
        "form.message": "Tell us about your project",
        "form.send": "Send Message",

        /* Footer */
        "footer.about": "Expert carpentry and African-inspired design for over 20 years.",
        "footer.quicklinks": "Quick Links",
        "footer.services": "Services",
        "footer.svc.chairs": "Custom Chairs",
        "footer.svc.roofing": "House Roofing",
        "footer.svc.furniture": "Furniture Design",
        "footer.svc.restoration": "Restoration",
        "footer.newsletter": "Newsletter",
        "footer.newsletter.desc": "Subscribe to get updates on new projects",
        "footer.newsletter.placeholder": "Your email",
        "footer.copyright": "© 2024 LouisCraft. All rights reserved. | Crafted with passion in Africa",

        /* JS alert messages (used by main.js) */
        "alert.contact.success": "Thank you, {name}! Your message has been received. We'll contact you soon at {email}",
        "alert.contact.incomplete": "Please fill in all required fields.",
        "alert.newsletter.success": "Thank you for subscribing with {email}!"
    },

    fr: {
        /* Navbar */
        "nav.home": "Accueil",
        "nav.services": "Services",
        "nav.portfolio": "Portfolio",
        "nav.about": "À propos",
        "nav.contact": "Contact",
        "nav.quote": "Demander un devis",

        /* Hero */
        "hero.title": "Menuiserie d'exception",
        "hero.subtitle": "Des créations intemporelles issues du patrimoine africain",
        "hero.description": "Menuiserie experte, chaises sur mesure, toitures superbes et mobilier personnalisé fabriqués avec passion",
        "hero.btnPortfolio": "Découvrir le portfolio",
        "hero.btnQuote": "Demander un devis",

        /* Services */
        "services.title": "Nos services",
        "services.subtitle": "Des solutions de menuiserie complètes adaptées à vos besoins",
        "service.chairs.title": "Chaises & sièges sur mesure",
        "service.chairs.desc": "Chaises fabriquées à la main alliant motifs africains traditionnels et confort moderne. Chaque pièce est unique et conçue pour durer des générations.",
        "service.roofing.title": "Toiture de maison",
        "service.roofing.desc": "Solutions de toiture professionnelles utilisant des matériaux haut de gamme et des styles architecturaux africains traditionnels. Résistantes aux intempéries et magnifiques.",
        "service.interior.title": "Mobilier d'intérieur",
        "service.interior.desc": "Aménagement intérieur complet avec du mobilier sur mesure. Mariez l'esthétique africaine traditionnelle au confort contemporain.",
        "service.doors.title": "Portes & encadrements",
        "service.doors.desc": "Portes et encadrements en bois finement travaillés aux motifs africains traditionnels. Chaque design raconte une histoire de savoir-faire.",
        "service.custom.title": "Menuiserie sur mesure",
        "service.custom.desc": "Travaux de menuiserie sur mesure pour tout projet. De la consultation à l'installation finale, nous nous occupons de tout.",
        "service.restoration.title": "Restauration & finition",
        "service.restoration.desc": "Restaurez et rénovez vos précieuses pièces en bois. Nous préservons la beauté du mobilier patrimonial.",

        /* Portfolio */
        "portfolio.title": "Notre portfolio",
        "portfolio.subtitle": "Une vitrine de nos plus belles réalisations en menuiserie",
        "portfolio.tab.all": "Toutes les œuvres",
        "portfolio.tab.chairs": "Chaises",
        "portfolio.tab.roofing": "Toitures",
        "portfolio.tab.furniture": "Mobilier",
        "pf.chair1.title": "Ensemble à manger Savanna en noyer",
        "pf.chair1.desc": "Ensemble quatre places en noyer massif avec assises en lin matelassé et pieds fuselés",
        "pf.chair2.title": "Fauteuil lounge confort moderne",
        "pf.chair2.desc": "Structure en noyer sculpté avec une assise rembourrée profonde pour un confort toute la journée",
        "pf.chair3.title": "Ensemble de mobilier en cuir noir",
        "pf.chair3.desc": "Siège d'exception sculpté à la main aux motifs traditionnels raffinés",
        "pf.chair4.title": "Une chaise longue moderne",
        "pf.chair4.desc": "Une élégante chaise longue beige aux pieds en bois naturel, alliant confort moderne et élégance intemporelle en une seule pièce accueillante",
        "pf.roof1.title": "Charpente / structure de chevrons en bois",
        "pf.roof1.desc": "Ce projet de toiture illustre toute la progression de l'installation du toit d'un bâtiment à deux étages",
        "pf.roof2.title": "Toit à pignon en pente",
        "pf.roof2.desc": "Ce toit présente un design à pignon en pente sur un seul niveau, construit avec des fermes en bois et fini avec des tôles de zinc durables pour la solidité, la ventilation et la résistance aux intempéries.",
        "pf.roof3.title": "Toiture africaine moderne",
        "pf.roof3.desc": "Design hybride alliant les formes patrimoniales aux matériaux contemporains",
        "pf.furn1.title": "Ensemble à manger africain",
        "pf.furn1.desc": "Table à manger complète en noyer avec sièges rembourrés assortis",
        "pf.furn2.title": "Table basse d'artisan",
        "pf.furn2.desc": "Table basse décorative avec détails traditionnels sculptés à la main",
        "pf.furn3.title": "Ensemble de chambre",
        "pf.furn3.desc": "Collection de chambre coordonnée en bois massif chaleureux",
        "pf.furn4.title": "Armoire de rangement patrimoniale",
        "pf.furn4.desc": "Armoire fabriquée à la main avec panneaux de porte décoratifs sculptés",

        /* About */
        "about.title": "À propos de LouisBudgetDesign",
        "about.welcome": "Bienvenue chez LouisBudgetDesign",
        "about.intro": "Avec plus de 20 ans d'expérience dans la menuiserie africaine traditionnelle, nous unissons patrimoine et innovation. Nos artisans sont formés aux techniques ancestrales tout en adoptant les principes du design moderne.",
        "about.feature.quality.title": "Savoir-faire de qualité",
        "about.feature.quality.desc": "Chaque pièce est fabriquée à la main avec un grand souci du détail",
        "about.feature.materials.title": "Matériaux durables",
        "about.feature.materials.desc": "Nous utilisons du bois africain issu de sources responsables",
        "about.feature.custom.title": "Créations sur mesure",
        "about.feature.custom.desc": "Des pièces uniques adaptées à votre vision",
        "about.stat.projects": "Projets réalisés",
        "about.stat.years": "Ans d'expérience",
        "about.stat.satisfaction": "Satisfaction client",

        /* Testimonials */
        "testimonials.title": "Ce que disent nos clients",
        "testimonials.subtitle": "Découvrez l'expérience de clients satisfaits avec TimberCraft",
        "testimonial.1.text": "« Les chaises que nous avons commandées sont absolument magnifiques ! Le savoir-faire est impeccable et le souci du détail est remarquable. Vivement recommandé ! »",
        "testimonial.2.text": "« La rénovation de notre toit a été menée avec professionnalisme. L'équipe a compris notre vision et a dépassé nos attentes. Cela vaut chaque centime ! »",
        "testimonial.3.text": "« TimberCraft a transformé notre maison avec de superbes meubles et portes. L'expertise de l'équipe en design africain se voit dans chaque pièce. »",

        /* Contact */
        "contact.title": "Contactez-nous",
        "contact.subtitle": "Prêt à démarrer votre projet de menuiserie ? Contactez-nous dès aujourd'hui !",
        "contact.address": "Adresse",
        "contact.phone": "Téléphone",
        "contact.email": "E-mail",
        "contact.hours": "Horaires",
        "contact.hours.value": "Lun - Ven : 8h00 - 18h00<br>Sam : 9h00 - 16h00",
        "form.name": "Votre nom",
        "form.email": "Votre e-mail",
        "form.phone": "Votre téléphone",
        "form.message": "Parlez-nous de votre projet",
        "form.send": "Envoyer le message",

        /* Footer */
        "footer.about": "Menuiserie experte et design d'inspiration africaine depuis plus de 20 ans.",
        "footer.quicklinks": "Liens rapides",
        "footer.services": "Services",
        "footer.svc.chairs": "Chaises sur mesure",
        "footer.svc.roofing": "Toiture de maison",
        "footer.svc.furniture": "Création de mobilier",
        "footer.svc.restoration": "Restauration",
        "footer.newsletter": "Infolettre",
        "footer.newsletter.desc": "Abonnez-vous pour suivre nos nouveaux projets",
        "footer.newsletter.placeholder": "Votre e-mail",
        "footer.copyright": "© 2024 LouisCraft. Tous droits réservés. | Conçu avec passion en Afrique",

        /* JS alert messages (used by main.js) */
        "alert.contact.success": "Merci, {name} ! Votre message a bien été reçu. Nous vous contacterons bientôt à {email}",
        "alert.contact.incomplete": "Veuillez remplir tous les champs obligatoires.",
        "alert.newsletter.success": "Merci de votre abonnement avec {email} !"
    }
};

/* Current language — read saved choice, default to English */
let currentLang = localStorage.getItem('lang') || 'en';

/* Look up a translated string by key for the current language.
   Falls back to English, then to the key itself if missing. */
function t(key) {
    const lang = translations[currentLang] || translations.en;
    return lang[key] || translations.en[key] || key;
}

/* Apply a language across the whole page */
function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang;

    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });

    // Content that contains HTML (e.g. line breaks)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });

    // Input / textarea placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });

    // Highlight the active button in the switcher
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
}

/* Wire up the EN | FR switcher */
const langSwitch = document.getElementById('langSwitch');
if (langSwitch) {
    langSwitch.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });
}

/* Apply the saved/default language on load */
setLanguage(currentLang);
