"""Public product and issuer names carried forward from the blood lot-release series."""
import re

PRODUCTS=[
    ('白蛋白',r'^人血白蛋白(?:注射液)?$'),
    ('静丙',r'^(?:冻干)?静注人免疫球蛋白(?:\(pH4\))?$'),
    ('乙肝特免',r'^(?:冻干)?(?:静注)?乙型肝炎人免疫球蛋白(?:\(pH4\))?$'),
    ('狂犬病特免',r'^狂犬病人免疫球蛋白$'),
    ('破伤风特免',r'^破伤风人免疫球蛋白$'),
    ('其他人免疫球蛋白',r'^(?:组织胺|皮下注射)?人免疫球蛋白$'),
    ('凝血因子VIII',r'^人凝血因子\s*VIII$'),
    ('凝血因子IX',r'^人凝血因子\s*IX$'),
    ('凝血酶原复合物',r'^人凝血酶原复合物$'),
    ('纤维蛋白原',r'^人纤维蛋白原$'),
    ('纤维蛋白粘合剂',r'^人纤维蛋白[粘黏]合剂$'),
    ('人凝血酶',r'^人凝血酶$'),
]

PATTERNS=[(label,re.compile(pattern,re.I)) for label,pattern in PRODUCTS]

GROUPS=[
    ('上海莱士（002252）',[
        ('上海莱士血液制品',''),('郑州莱士|郑州邦和|邦和药业','2014-01-28'),
        ('同路生物','2014-12-22'),('浙江海康','2016-12-26'),
        ('广西莱士|广西冠峰','2023-11-01'),('南岳生物|湖南紫光古汉南岳','2025-06-20'),
    ]),
    ('天坛生物（600161）',[
        ('北京天坛生物|成都蓉生',''),
        ('贵州中泰|国药集团贵州血液制品|国药集团贵州生物制药','2017-04-27'),
        ('国药集团上海血液制品|国药集团武汉血液制品|国药集团武汉生物制药|国药集团兰州生物制药|国药集团兰州血液制品|兰州兰生血液制品','2018-01-01'),
        ('西安回天|国药集团西安血液制品','2022-09-01'),
        ('武汉中原瑞德|武汉瑞德生物','2024-10-16'),
    ]),
    ('华兰生物（002007）',[('华兰生物工程','')]),
    ('派林生物（000403）',[('广东双林',''),('哈尔滨派斯菲科|哈尔滨世亨生物工程药业','2021-02-01')]),
    ('博雅生物（300294）',[('华润博雅|江西博雅生物制药|博雅生物制药集团',''),('绿十字\\(中国\\)','2024-11-06')]),
    ('卫光生物（002880）',[('深圳市卫光生物|深圳市卫武光明','')]),
    ('博晖创新（300318）',[('河北大安|博晖生物制药\\(河北\\)','2015-06-01'),('广东卫伦','2017-01-01')]),
]

MAPPING=[(group,re.compile(f'^(?:{aliases})'),since)
         for group,companies in GROUPS for aliases,since in companies]

FOREIGN=[('杰特贝林（CSL Behring）',r'杰特贝林|CSL Behring'),
         ('基立福（Grifols）',r'基立福|Grifols'),
         ('奥克特珐玛（Octapharma）',r'奥克特珐玛|Octapp?harma'),
         ('韩国绿十字（GC Biopharma）',r'绿十字株式会社|Green Cross Corporation|GC Biopharma'),
         ('武田（Takeda）',r'^Takeda'),
         ('Baxter（历史持有人）',r'^Baxter'),
         ('Baxalta（历史持有人）',r'^Baxalta'),
         ('Bio Products Laboratory',r'^Bio Products Laboratory'),
         ('Biotest',r'^Biotest'),
         ('SK Plasma／SK Chemicals',r'^SK Plasma|^SK Chemicals')]

def category(product):
    return next((label for label,pattern in PATTERNS if pattern.fullmatch(product)),'')

def group(holder,first,last):
    for label,pattern,since in MAPPING:
        if pattern.search(holder):
            if first>=since:
                return label,'已核集团归属'
            if last>=since:
                return holder,'签发区间跨并购时点'
            return holder,'并购前独立主体'
    for label,pattern in FOREIGN:
        if re.search(pattern,holder,re.I):
            return label,'境外持有人归组'
    if holder.startswith(('广东丹霞生物制药','博雅生物制药(广东)')):
        return '广东丹霞生物制药有限公司','按公示主体'
    return holder,'按公示主体'

def local_identifier(certificate,receipt,issuer):
    certificate=certificate.replace('批簽','批签').translate(str.maketrans('','','{}')).removesuffix('号')
    if re.fullmatch(r'批签[^0-9]*20\d{2}[A-Z0-9-]{4,9}',certificate):
        return certificate
    if issuer.startswith('广东') and re.fullmatch(r'20\d{2}A\d{5}',receipt):
        return '收检:粤'+receipt
    return ''
