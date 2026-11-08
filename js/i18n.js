/*
 * Interface languages. The chrome (menus, buttons, tool names, dialogs) is translated by exact English
 * text; maths results, step explanations and hints stay in English. Translations of the interface were
 * written without a native-speaker review – corrections are welcome (see CONTRIBUTING.md).
 * Order of columns: es, fr, ar, ur, hi
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.I18N = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    const LANGS = [['en', 'English', 'ltr'], ['es', 'Español', 'ltr'], ['fr', 'Français', 'ltr'], ['ar', 'العربية', 'rtl'], ['ur', 'اردو', 'rtl'], ['hi', 'हिन्दी', 'ltr']];
    const COL = { es: 0, fr: 1, ar: 2, ur: 3, hi: 4 };
    const D = {
        'Help': ['Ayuda', 'Aide', 'مساعدة', 'مدد', 'सहायता'], 'Settings': ['Ajustes', 'Réglages', 'الإعدادات', 'ترتیبات', 'सेटिंग्स'], 'Install': ['Instalar', 'Installer', 'تثبيت', 'انسٹال کریں', 'इंस्टॉल करें'],
        'Clear': ['Borrar', 'Effacer', 'مسح', 'صاف کریں', 'साफ़ करें'], 'Ask': ['Preguntar', 'Demander', 'اسأل', 'پوچھیں', 'पूछें'], 'Close': ['Cerrar', 'Fermer', 'إغلاق', 'بند کریں', 'बंद करें'],
        'Scan a photo': ['Escanear una foto', 'Scanner une photo', 'مسح صورة', 'تصویر اسکین کریں', 'फ़ोटो स्कैन करें'],
        'Skip to input': ['Saltar a la entrada', 'Aller à la saisie', 'انتقل إلى الإدخال', 'ان پٹ پر جائیں', 'इनपुट पर जाएँ'],
        'Search tools, examples, actions…': ['Buscar herramientas, ejemplos, acciones…', 'Rechercher outils, exemples, actions…', 'ابحث عن الأدوات والأمثلة والإجراءات…', 'ٹولز، مثالیں، اعمال تلاش کریں…', 'टूल, उदाहरण, क्रियाएँ खोजें…'],
        'Theme': ['Tema', 'Thème', 'المظهر', 'تھیم', 'थीम'], 'Light': ['Claro', 'Clair', 'فاتح', 'روشن', 'हल्का'], 'Dark': ['Oscuro', 'Sombre', 'داكن', 'گہرا', 'गहरा'], 'Auto': ['Automático', 'Auto', 'تلقائي', 'خودکار', 'स्वचालित'],
        'Learning': ['Aprendizaje', 'Apprentissage', 'التعلّم', 'سیکھنا', 'सीखना'],
        'Teaching mode – hide answers and steps until I ask': ['Modo enseñanza: ocultar respuestas y pasos hasta que los pida', 'Mode enseignement : masquer les réponses et les étapes jusqu’à ma demande', 'وضع التعليم: إخفاء الإجابات والخطوات حتى أطلبها', 'تدریسی موڈ: جب تک میں نہ کہوں جوابات اور مراحل چھپائیں', 'शिक्षण मोड: मेरे कहने तक उत्तर और चरण छिपाएँ'],
        'Your choices are remembered on this device. Plots follow the theme automatically.': ['Tus elecciones se guardan en este dispositivo. Los gráficos siguen el tema automáticamente.', 'Vos choix sont mémorisés sur cet appareil. Les graphiques suivent automatiquement le thème.', 'يتم تذكّر اختياراتك على هذا الجهاز. تتبع الرسوم البيانية المظهر تلقائيًا.', 'آپ کی پسند اس آلے پر محفوظ رہتی ہے۔ گراف خودکار طور پر تھیم کی پیروی کرتے ہیں۔', 'आपकी पसंद इस डिवाइस पर याद रखी जाती है। ग्राफ़ अपने आप थीम का पालन करते हैं।'],
        'Language': ['Idioma', 'Langue', 'اللغة', 'زبان', 'भाषा'],
        'Ask in plain English': ['Pregunta en inglés sencillo', 'Posez la question en anglais simple', 'اسأل بالإنجليزية البسيطة', 'سادہ انگریزی میں پوچھیں', 'सरल अंग्रेज़ी में पूछें'],
        'Tool': ['Herramienta', 'Outil', 'الأداة', 'ٹول', 'टूल'],
        'Core calculus': ['Cálculo básico', 'Calcul de base', 'أساسيات التفاضل والتكامل', 'بنیادی کیلکولس', 'मूल कलन'], 'Explore & visualise': ['Explorar y visualizar', 'Explorer et visualiser', 'استكشاف وتصوّر', 'دریافت اور تصور', 'खोजें और देखें'], 'Algebra & sums': ['Álgebra y sumas', 'Algèbre et sommes', 'الجبر والمجاميع', 'الجبرا اور مجموعے', 'बीजगणित और योग'], 'Advanced': ['Avanzado', 'Avancé', 'متقدّم', 'ایڈوانسڈ', 'उन्नत'],
        'Derivative': ['Derivada', 'Dérivée', 'المشتقة', 'مشتق', 'अवकलज'], 'Integral': ['Integral', 'Intégrale', 'التكامل', 'انٹیگرل', 'समाकलन'], 'Limits': ['Límites', 'Limites', 'النهايات', 'حدود', 'सीमाएँ'], 'Taylor series': ['Serie de Taylor', 'Série de Taylor', 'متسلسلة تايلور', 'ٹیلر سیریز', 'टेलर श्रेणी'], 'Analysis': ['Análisis', 'Analyse', 'التحليل', 'تجزیہ', 'विश्लेषण'],
        'Graph & sliders': ['Gráfico y deslizadores', 'Graphique et curseurs', 'الرسم والمنزلقات', 'گراف اور سلائیڈرز', 'ग्राफ़ और स्लाइडर'], 'Riemann sums': ['Sumas de Riemann', 'Sommes de Riemann', 'مجاميع ريمان', 'ریمان مجموعے', 'रीमान योग'], 'Area & volume': ['Área y volumen', 'Aire et volume', 'المساحة والحجم', 'رقبہ اور حجم', 'क्षेत्रफल और आयतन'], 'Root finding': ['Búsqueda de raíces', 'Recherche de racines', 'إيجاد الجذور', 'جذر تلاش کرنا', 'मूल खोजना'], 'Fourier series': ['Serie de Fourier', 'Série de Fourier', 'متسلسلة فورييه', 'فوریئر سیریز', 'फ़ूरियर श्रेणी'],
        'Calculator': ['Calculadora', 'Calculatrice', 'الآلة الحاسبة', 'کیلکولیٹر', 'कैलकुलेटर'], 'Equation solver': ['Resolver ecuaciones', 'Résolution d’équations', 'حلّ المعادلات', 'مساوات حل کنندہ', 'समीकरण हल'], 'Sums & series': ['Sumas y series', 'Sommes et séries', 'المجاميع والمتسلسلات', 'مجموعے اور سیریز', 'योग और श्रेणियाँ'], 'Number theory': ['Teoría de números', 'Théorie des nombres', 'نظرية الأعداد', 'نظریۂ اعداد', 'संख्या सिद्धांत'], 'Units': ['Unidades', 'Unités', 'الوحدات', 'اکائیاں', 'इकाइयाँ'], 'Statistics': ['Estadística', 'Statistiques', 'الإحصاء', 'شماریات', 'सांख्यिकी'],
        'ODEs': ['EDO', 'EDO', 'المعادلات التفاضلية', 'تفرقی مساوات', 'अवकल समीकरण'], 'Multivariable': ['Multivariable', 'Multivariable', 'متعدد المتغيّرات', 'کثیر متغیری', 'बहुचर'], 'Vector calculus': ['Cálculo vectorial', 'Analyse vectorielle', 'التفاضل الاتجاهي', 'ویکٹر کیلکولس', 'सदिश कलन'], 'Matrices': ['Matrices', 'Matrices', 'المصفوفات', 'میٹرکس', 'आव्यूह'], 'Transforms': ['Transformadas', 'Transformées', 'التحويلات', 'تبدیلیاں', 'रूपांतरण'], 'Complex': ['Complejos', 'Complexes', 'الأعداد المركبة', 'مخلوط اعداد', 'सम्मिश्र'],
        'Compute': ['Calcular', 'Calculer', 'احسب', 'حساب کریں', 'गणना करें'], 'Options': ['Opciones', 'Options', 'الخيارات', 'اختیارات', 'विकल्प'], 'Symbols': ['Símbolos', 'Symboles', 'رموز', 'علامات', 'प्रतीक'], 'Scan': ['Escanear', 'Scanner', 'مسح', 'اسکین', 'स्कैन'], 'Try an example…': ['Prueba un ejemplo…', 'Essayez un exemple…', 'جرّب مثالًا…', 'مثال آزمائیں…', 'उदाहरण आज़माएँ…'],
        'Precision & plots': ['Precisión y gráficos', 'Précision et graphiques', 'الدقة والرسوم', 'درستگی اور گراف', 'परिशुद्धता और ग्राफ़'],
        'Notebook': ['Cuaderno', 'Carnet', 'الدفتر', 'نوٹ بک', 'नोटबुक'], 'New': ['Nuevo', 'Nouveau', 'جديد', 'نیا', 'नया'], 'Rename': ['Renombrar', 'Renommer', 'إعادة تسمية', 'نام بدلیں', 'नाम बदलें'], 'Delete': ['Eliminar', 'Supprimer', 'حذف', 'حذف کریں', 'हटाएँ'], 'Export notebook (.md)': ['Exportar cuaderno (.md)', 'Exporter le carnet (.md)', 'تصدير الدفتر (.md)', 'نوٹ بک برآمد کریں (.md)', 'नोटबुक निर्यात करें (.md)'], 'Back up all': ['Copia de seguridad', 'Tout sauvegarder', 'نسخ احتياطي للكل', 'سب کا بیک اپ', 'सब का बैकअप'], 'Import': ['Importar', 'Importer', 'استيراد', 'درآمد کریں', 'आयात करें'],
        'History': ['Historial', 'Historique', 'السجل', 'تاریخ', 'इतिहास'], 'Clear history': ['Borrar historial', 'Effacer l’historique', 'مسح السجل', 'تاریخ صاف کریں', 'इतिहास साफ़ करें'],
        'Results': ['Resultados', 'Résultats', 'النتائج', 'نتائج', 'परिणाम'], '2D plot': ['Gráfico 2D', 'Graphique 2D', 'رسم 2D', '2D پلاٹ', '2D ग्राफ़'], '3D plot': ['Gráfico 3D', 'Graphique 3D', 'رسم 3D', '3D پلاٹ', '3D ग्राफ़'], 'Steps': ['Pasos', 'Étapes', 'الخطوات', 'مراحل', 'चरण'],
        'Copy': ['Copiar', 'Copier', 'نسخ', 'کاپی', 'कॉपी'], 'Save': ['Guardar', 'Enregistrer', 'حفظ', 'محفوظ کریں', 'सहेजें'], 'Share': ['Compartir', 'Partager', 'مشاركة', 'شیئر', 'साझा करें'], 'Embed': ['Insertar', 'Intégrer', 'تضمين', 'ایمبیڈ', 'एम्बेड'], 'Listen': ['Escuchar', 'Écouter', 'استمع', 'سنیں', 'सुनें'], 'Export': ['Exportar', 'Exporter', 'تصدير', 'برآمد', 'निर्यात'], 'Save PNG': ['Guardar PNG', 'Enregistrer en PNG', 'حفظ PNG', 'PNG محفوظ کریں', 'PNG सहेजें'],
        'How was this checked?': ['¿Cómo se comprobó?', 'Comment cela a-t-il été vérifié ?', 'كيف تم التحقق؟', 'اس کی جانچ کیسے ہوئی؟', 'इसकी जाँच कैसे हुई?'],
        'Ready to work offline': ['Listo para funcionar sin conexión', 'Prêt à fonctionner hors ligne', 'جاهز للعمل دون اتصال', 'آف لائن کام کے لیے تیار', 'ऑफ़लाइन काम के लिए तैयार'],
        'Tools': ['Herramientas', 'Outils', 'الأدوات', 'ٹولز', 'टूल'], 'Input': ['Entrada', 'Saisie', 'الإدخال', 'ان پٹ', 'इनपुट'], 'Result': ['Resultado', 'Résultat', 'النتيجة', 'نتیجہ', 'परिणाम'], 'Top': ['Arriba', 'Haut', 'أعلى', 'اوپر', 'ऊपर'],
        'Practice': ['Práctica', 'Entraînement', 'تدريب', 'مشق', 'अभ्यास'], 'Topic': ['Tema', 'Thème', 'الموضوع', 'موضوع', 'विषय'], 'Level': ['Nivel', 'Niveau', 'المستوى', 'سطح', 'स्तर'],
        '1 · Warm-up': ['1 · Calentamiento', '1 · Échauffement', '1 · إحماء', '1 · ابتدائی', '1 · वार्म-अप'], '2 · Standard': ['2 · Estándar', '2 · Standard', '2 · قياسي', '2 · معیاری', '2 · मानक'], '3 · Challenge': ['3 · Desafío', '3 · Défi', '3 · تحدٍّ', '3 · چیلنج', '3 · चुनौती'],
        'New problem': ['Nuevo problema', 'Nouveau problème', 'مسألة جديدة', 'نیا مسئلہ', 'नई समस्या'], 'Check': ['Comprobar', 'Vérifier', 'تحقق', 'جانچیں', 'जाँचें'], 'Hint': ['Pista', 'Indice', 'تلميح', 'اشارہ', 'संकेत'], 'Show solution': ['Mostrar solución', 'Afficher la solution', 'أظهر الحل', 'حل دکھائیں', 'हल दिखाएँ'],
        'Scan an expression': ['Escanear una expresión', 'Scanner une expression', 'مسح تعبير', 'اظہار اسکین کریں', 'व्यंजक स्कैन करें'], 'Take photo or choose image': ['Tomar foto o elegir imagen', 'Prendre une photo ou choisir une image', 'التقط صورة أو اختر صورة', 'تصویر کھینچیں یا منتخب کریں', 'फ़ोटो लें या छवि चुनें'], 'No image yet.': ['Aún no hay imagen.', 'Aucune image pour le moment.', 'لا توجد صورة بعد.', 'ابھی کوئی تصویر نہیں۔', 'अभी कोई छवि नहीं।'],
        'Recognised text – check and correct it': ['Texto reconocido: revísalo y corrígelo', 'Texte reconnu : vérifiez et corrigez', 'النص المُتعرَّف عليه: راجعه وصحّحه', 'پہچانا گیا متن: جانچیں اور درست کریں', 'पहचाना गया पाठ: जाँचें और सुधारें'], 'Use as expression': ['Usar como expresión', 'Utiliser comme expression', 'استخدمه كتعبير', 'اظہار کے طور پر استعمال کریں', 'व्यंजक के रूप में उपयोग करें'], 'Ask as a question': ['Preguntar como pregunta', 'Poser comme question', 'اطرحه كسؤال', 'سوال کے طور پر پوچھیں', 'प्रश्न के रूप में पूछें']
    };
    const store = { get: () => { try { return localStorage.getItem('cs_lang'); } catch (e) { return null; } }, set: v => { try { localStorage.setItem('cs_lang', v); } catch (e) { /* blocked */ } } };
    let lang = 'en';
    const tr = (en, l) => { const row = D[en]; return row && COL[l] != null ? row[COL[l]] : en; };
    const SKIP = 'script,style,textarea,.katex,.tex,.result-content,.result-rows,.step-card,.preview-box,.history-list,.nb-list,.practice-problem,.practice-hints,#plotDesc,.js-plotly-plot';
    function applyText(n, l) {
        if (n.__en === undefined) { const t = n.nodeValue.trim(); if (t && D[t]) { n.__en = t; n.__lead = n.nodeValue.match(/^\s*/)[0]; n.__trail = n.nodeValue.match(/\s*$/)[0]; } else n.__en = null; }
        if (n.__en === null) return;
        n.nodeValue = n.__lead + (l === 'en' ? n.__en : tr(n.__en, l)) + n.__trail;
    }
    function apply(root, l) {
        l = l || lang; root = root || document.body; if (!root) return;
        const walk = node => {
            if (node.nodeType === 3) { if (node.parentElement && node.parentElement.closest(SKIP)) return; const t = node.nodeValue.trim(); if (t && (D[t] || node.__en)) applyText(node, l); return; }
            if (node.nodeType !== 1 || node.matches(SKIP)) return;
            for (const a of ['placeholder', 'title', 'aria-label']) { const k = 'data-i18n-en-' + a; const v = node.getAttribute(a); if (v == null) continue; if (!node.hasAttribute(k)) node.setAttribute(k, D[v] ? v : ''); const en = node.getAttribute(k); if (en) node.setAttribute(a, l === 'en' ? en : tr(en, l)); }
            node.childNodes.forEach(walk);
        };
        walk(root);
    }
    function set(l) {
        if (!LANGS.some(x => x[0] === l)) l = 'en'; lang = l; const meta = LANGS.find(x => x[0] === l);
        document.documentElement.lang = l; document.documentElement.dir = meta[2]; document.body.classList.toggle('rtl', meta[2] === 'rtl'); store.set(l); apply(document.body, l);
    }
    function init() {
        let l = store.get() || ((navigator.language || 'en').slice(0, 2)); if (!LANGS.some(x => x[0] === l)) l = 'en';
        const sel = document.getElementById('langSelect');
        if (sel) { sel.innerHTML = LANGS.map(([c, n]) => `<option value="${c}">${n}</option>`).join(''); sel.value = l; sel.addEventListener('change', () => set(sel.value)); }
        const obs = new MutationObserver(muts => { if (lang === 'en') return; muts.forEach(m => m.addedNodes.forEach(n => apply(n, lang))); });
        obs.observe(document.body, { childList: true, subtree: true });
        if (l !== 'en') set(l); else { document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr'; }
    }
    return { LANGS, D, apply, set, init, tr, get lang() { return lang; } };
});
