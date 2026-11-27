"""Public product and issuer names carried forward from the lot-release series."""
import re
import unicodedata

GROUPS = {
    '智飞生物（300122）': ('北京智飞绿竹','安徽智飞龙科马'),
    '万泰生物（603392）': ('厦门万泰沧海',),
    '康希诺（688185）': ('康希诺生物',),
    '沃森生物（300142）': ('玉溪沃森','玉溪泽润','上海泽润'),
    '康泰生物（300601）': ('深圳康泰生物','北京民海生物'),
    '欧林生物（688319）': ('成都欧林生物',),
    '中慧生物（02627）': ('江苏中慧元通',),
    '华兰疫苗（301207）': ('华兰生物疫苗',),
    '成大生物（688739）': ('辽宁成大生物',),
    '百克生物（688276）': ('长春百克生物',),
    '康华生物（300841）': ('成都康华生物',),
    '金迪克（688670）': ('江苏金迪克',),
    '艾美疫苗（06660）': ('艾美诚信','艾美荣誉','艾美坚持','艾美行动','艾美卫信','艾美康淮'),
    '科兴控股（SVA）': ('北京科兴生物制品','北京科兴中维生物','科兴(大连)疫苗'),
    '中国生物（国药集团）': tuple(city+'生物制品研究所' for city in ('北京','长春','上海','武汉','成都','兰州'))+('长春祈健',),
    '默沙东': ('merck sharp','msd ireland'),
    '赛诺菲': ('sanofi','深圳赛诺菲'),
    '辉瑞': ('pfizer',),
    '葛兰素史克': ('glaxosmithkline',),
}

CATEGORY = (
    ('多联苗（含百白破）',r'百白破.*(嗜血杆菌|脊髓灰质炎|乙型肝炎)|百白破.*四联|百白破.*五联|百白破.*六联'),
    ('HPV',r'人乳头瘤|HPV'),
    ('流感',r'流感(?!嗜血杆菌)|流行性感冒'),
    ('狂犬病',r'狂犬'),
    ('肺炎球菌',r'肺炎球菌'),
    ('流脑',r'脑膜炎球菌'),
    ('Hib',r'流感嗜血杆菌'),
    ('乙肝',r'乙型肝炎(?!联合)'),
    ('甲乙肝联合',r'甲型乙型肝炎'),
    ('甲肝',r'甲型肝炎'),
    ('戊肝',r'戊型肝炎'),
    ('脊灰',r'脊髓灰质炎'),
    ('百白破',r'百白破'),
    ('白破',r'白喉.*破伤风|白破'),
    ('破伤风',r'破伤风'),
    ('麻腮风及单苗',r'麻腮风|麻腮|麻风|麻疹|腮腺炎|风疹'),
    ('卡介苗',r'卡介苗'),
    ('水痘',r'水痘'),
    ('轮状病毒',r'轮状病毒'),
    ('乙脑',r'乙型脑炎'),
    ('带状疱疹',r'带状疱疹'),
    ('EV71',r'肠道病毒71'),
    ('霍乱',r'霍乱'),
    ('伤寒',r'伤寒'),
    ('黄热',r'黄热'),
    ('森林脑炎',r'森林脑炎'),
    ('出血热',r'出血热'),
    ('钩端螺旋体',r'钩端螺旋体'),
    ('新冠',r'新型冠状病毒|新冠|COVID'),
    ('RSV',r'呼吸道合胞病毒|RSV'),
    ('埃博拉',r'埃博拉'),
)

ALIASES = {
    '中检院':'中国药品检定研究院',
    '中国食品药品检定研究院':'中国药品检定研究院',
    '上海市食品药品检验研究院':'上海市药品检验研究院',
    '上海市食品药品检验所':'上海市药品检验研究院',
    '江苏省食品药品监督检验研究院':'江苏省药品监督检验研究院',
    '上海市药品检验所':'上海市药品检验研究院',
}

def normalize(text):
    return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',text)).strip()

def clean_name(text):
    text=normalize(text)
    # Some official notices append an English translation without a separator.
    text=re.sub(r'(?:\s*\()?(?:Recombinant Human Papillomavirus|Hepatitis A(?: and B)? Vaccine|Hepatitis A and B Combined Vaccine|Recombinant Hepatitis B Vaccine|Influenza Vaccine|Poliomyelitis(?: Vaccine| \(Live\))|Japanese Encephalitis Vaccine|Enterovirus Type|23-valent Pneumococcal).*$', '', text, flags=re.I)
    text=re.sub(r'(?<=[\u3400-\u9fff])\s*\(\s*$', '', text)
    return text.strip()

def clean_holder(text):
    text=normalize(text)
    found=re.match(r'^([\u3400-\u9fff][^A-Za-z]*?(?:股份有限公司|有限责任公司|有限公司|股份公司|研究所|研究院))',text)
    if found:
        return found[1].replace('（','(').replace('）',')')
    return text.strip(' .')

def product_type(product):
    return next((category for category, pattern in CATEGORY if re.search(pattern,product,re.I)),'其他疫苗')

def group_name(holder):
    normalized=holder.casefold()
    return next((group for group,patterns in GROUPS.items() if any(normalized.startswith(x.casefold()) for x in patterns)),holder)

def issuer_name(raw):
    name=normalize(raw['issuer'])
    return ALIASES.get(name,name)

def batch_identity(raw):
    return (issuer_name(raw),clean_holder(raw['mah']),clean_name(raw['product']),
            normalize(raw['batch']).replace(' ',''))
