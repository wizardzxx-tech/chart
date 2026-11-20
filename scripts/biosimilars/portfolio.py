"""Company-sourced portfolio register. Dates refer to events unless called published or verified."""
VERIFY = '2026-11-20'
BIO = 'https://www.bio-thera.com/pipeline.html'
HEN = 'https://www.henlius.com/upload/202609/24/InterimReport2026.pdf'
HEN_SLIDES = 'https://www.henlius.com/upload/202611/06/Henlius2026InterimResultsInvestorSlides.pdf'
HEN_PIPE = 'https://www.henlius.com/Product.html'
HEN_SANDOZ = 'https://www.henlius.com/en/newsd/0/31504.html'
CELL = 'https://www.celltrion.com/en-us/products/pipelines/biologics'
CELL_PORT = 'https://www.celltrion.com/en-us/products/approved/biologics'
CELL_REVIEW = 'https://celltrion.com/en-us/company/media-center/press-release/4593'
SAM = 'https://www.samsungepisholdings.com/en/newsroom/newsroomView.do?idx=521'
SAM_PORT = 'https://www.samsungbioepis.com/en/product/product01.do?index=4'
BICON = 'https://www.bioconbiologics.com/our-business/global-biosimilars-portfolio/'
SAND_CMD = 'https://www.sandoz.com/sandoz-hosts-capital-markets-day-and-unveils-bio100-ambition-maximising-sandoz-value-its-golden/'
SAND_Q3 = 'https://sandoz-com.cms.sandoz.com/sites/default/files/Media%20Documents/Q3%202026%20highlights.pdf'
ALVO = 'https://www.alvotech.com/pipeline'
ALVO_NOV = 'https://www.alvotech.com/newsroom/alvotech-announces-financial-results-for-the-nine-months-to-september-30-2026-with-a-business-update'
ALVO_RE = 'https://www.alvotech.com/newsroom/alvotech-announces-resubmission-of-u-s-biologics-license-applications-for-avt05-a-proposed-biosimilar-to-simponi-and-simponi-aria-and-avt06-a-proposed-biosimilar-to-eylea'
ALVO80 = 'https://www.alvotech.com/newsroom/alvotech-announces-fda-acceptance-for-review-of-biologics-license-application-for-avt80-expanding-proposed-biosimilar-program-for-entyvio-to-subcutaneous-presentations'
SAND_PORT = 'https://www.sandoz.com/ca-en/sandoz-plus/products/'
NO_CODE = '研发代号未披露'

register = {}
company_audit = []
new_molecules = {
 'mepolizumab':('美泊利珠单抗','Nucala'),
 'cetuximab':('西妥昔单抗','Erbitux'),
 'evolocumab':('依洛尤单抗','Repatha'),
 'belimumab':('贝利尤单抗','Benlysta'),
 'ixekizumab':('依奇珠单抗','Taltz'),
 'certolizumab pegol':('赛妥珠单抗','Cimzia'),
 'canakinumab':('卡那单抗','Ilaris'),
 'ofatumumab':('奥法妥木单抗','Kesimpta'),
 'emicizumab':('艾美赛珠单抗','Hemlibra'),
 'durvalumab':('度伐利尤单抗','Imfinzi'),
 'benralizumab':('贝那利珠单抗','Fasenra'),
 'human insulin':('人胰岛素','Humulin'),
 'insulin lispro':('赖脯胰岛素','Humalog'),
 'pertuzumab and trastuzumab':('帕妥珠单抗／曲妥珠单抗复方','Phesgo'),
 'trastuzumab deruxtecan':('德曲妥珠单抗','Enhertu'),
}

def record(region, stage, source, date=None, description=None, published=None, expected=False):
    result = dict(region=region,stage=stage,source=source,verified=VERIFY)
    for key, value in [('date',date),('description',description),('published',published),('expected',expected)]:
        if value: result[key]=value
    return result

def g(region, stage, source, date=None, description=None, published=None):
    return record(region,stage,source,date,description,published)

def relation(name, role, regions, source, company=None):
    return dict(name=name,role=role,territories=regions,source=source,company=company)

def add(company, code, molecule, aliases, source, events=(), partners=(), display=None, note=None, developer=None):
    assert code not in register, code
    register[code] = dict(id=code,company=company,molecule=molecule,names=aliases.split('|') if aliases else [],
        source=source,display=display or code,description=note,developer=developer,
        milestones=list(events),partners=list(partners))

def market_set(source, stage, locations):
    return [g(region,stage,source) for region in locations.split()]

def ledger(company, official, identified, scope, gap, source):
    company_audit.append(dict(company=company,reported=official,identified=identified,scope=scope,gap=gap,source=source))

# Bio-Thera's public biosimilars plus the earlier bevacizumab dossier.
bat3306deal='https://www.bio-thera.com/en/news/1001375.html'
bat2306approval='https://www.bio-thera.com/news/1001462.html'
add('biothera','BAT1406','adalimumab','格乐立|Qletli',BIO,
    market_set(BIO,'获批','CN UK PK SY'))
add('biothera','BAT1706','bevacizumab','普贝希|Avzivi',BIO,
    market_set(BIO,'获批','CN US EU'))
add('biothera','BAT1806','tocilizumab','施瑞立|Tofidence|RoActemra Biosimilar',BIO,
    market_set(BIO,'获批','CN US EU UK CH'))
add('biothera','BAT2206','ustekinumab','艾沙力|喜沙立|Starjemza|Usymro|Ichalig',BIO,
    market_set(BIO,'获批','CN US EU UK SG'))
add('biothera','BAT2306','secukinumab','优卓美',bat2306approval,[
    g('CN','审评','https://static.cninfo.com.cn/finalpage/2026-04-28/1225212759.PDF','2026-04','公司披露 NMPA 受理'),
    g('CN','获批',bat2306approval,description='优卓美获得 NMPA 上市批准',published='2026-10-22')])
add('biothera','BAT2406','dupilumab','',BIO,[g('CN','I 期',BIO,description='I 期生物等效性研究')])
add('biothera','BAT2506','golimumab','阿舒立|Immgolis|Immgolis Intri|Gotenfia',BIO,[
    *market_set(BIO,'获批','US EU'),g('CN','审评',BIO,description='NMPA 已受理上市申请')],
    [relation('Intas','美国商业化授权','US','https://static.cninfo.com.cn/finalpage/2026-08-26/1225506014.PDF')])
add('biothera','BAT2606','mepolizumab','',BIO,[g('CN','关键临床完成',BIO,description='已完成关键临床研究')])
add('biothera','BAT3306','pembrolizumab','',BIO,[g('—','注册临床',BIO,description='官网披露处于注册临床阶段，地区以单独公告为准')],
    [relation('Avalon Pharma','独家商业化','沙特及约定中东、北非地区',bat3306deal)])
ledger('biothera','产品页区分创新药与生物类似药',9,'现行名录与具有可核对批准的贝伐珠单抗资产','进一步核对部分地区的受理、批准和实际销售日期。',BIO)

# Henlius keeps its Sandoz programs in one register with two company views.
organon = relation('Organon','独家商业化','协议约定市场',HEN)
sandoz_hen = relation('Sandoz','合作开发与区域商业化','协议约定市场',HEN_SANDOZ,'sandoz')
add('henlius','HLX11','pertuzumab','Poherdy',HEN,[
    g('EU','获批',HEN,'2026-04'),g('UK','获批',HEN,'2026-05')],[organon])
add('henlius','HLX14','denosumab','Bildyos|Bilprevda',HEN,[
    *market_set(HEN,'获批','US EU'),g('CA','获批',HEN,'2026-03'),
    g('CN','审评','https://www.henlius.com/en/newsd/0/31567.html','2026-09','NMPA 受理 120 mg 规格上市申请')],[organon])
add('henlius','HLX05-N','cetuximab','',HEN,[
    g('CN','IND 获批',HEN,'2026-04'),g('CN','I 期',HEN,'2026-07','中国首例给药')],[sandoz_hen])
add('henlius','HLX16','evolocumab','',HEN_SANDOZ,[g('—','项目已披露',HEN_SANDOZ)],[sandoz_hen])
add('henlius','henlius-belimumab','belimumab','',HEN_SANDOZ,[g('—','项目已披露',HEN_SANDOZ)],[sandoz_hen],display='Belimumab · '+NO_CODE)
add('henlius','HLX319','pertuzumab and trastuzumab','',HEN_PIPE,[
    g('CN','IND 获批',HEN,'2026-03'),g('CN','I 期',HEN_PIPE,description='皮下固定剂量复方')])
add('henlius','HLX04-O','bevacizumab','',HEN,[
    g('—','III 期',HEN,description='眼科项目。与肿瘤适应症的 HLX04 分开记录。')])
add('henlius','HLX17','pembrolizumab','',HEN,[
    g('US','I 期',HEN,'2026-06','美国首例给药'),
    g('CN','I 期',HEN_SLIDES,description='中国开发中')])
add('henlius','HLX18','nivolumab','',HEN_SLIDES,[
    g('CN','IND 获批',HEN,'2026-03'),g('CN','I 期',HEN_SLIDES,'2026-07','关键 PK 试验首例给药')])
ledger('henlius','以公司中报、投资者材料与产品目录为范围',15,'上市与公开具名在研项目，含 HLX04-O 和 HLX319','与 Sandoz 合作框架的其余品种未公开。HLX16 与贝利尤单抗具体临床阶段待核。',HEN)

# Samsung's eleven commercial presentations represented as ten unique assets.
sam_launches = [
 ('SB2','infliximab','Flixabi|Renflexis|Remaloce'),
 ('SB3','trastuzumab','Ontruzant|Samfenet'),
 ('SB4','etanercept','Benepali|Brenzys|Etoloce|Eticovo'),
 ('SB5','adalimumab','Imraldi|Hadlima|Adalloce'),
 ('SB8','bevacizumab','Aybintio|Onbevzi'),
 ('SB11','ranibizumab','Byooviz|Amelivu'),
 ('SB12','eculizumab','Epysqli'),
 ('SB15','aflibercept','Opuviz|Afilivu'),
 ('SB16','denosumab','Obodence|Ospomyv|Xbryk'),
 ('SB17','ustekinumab','Pyzchiva|Epyztek|Eksunbi'),
]
for code,molecule,aliases in sam_launches:
    partners=[relation('Sandoz','Pyzchiva 区域商业化','US EU',SAM_PORT,'sandoz')] if code=='SB17' else []
    add('samsung',code,molecule,aliases,SAM_PORT,
        [g('—','已商业化',SAM,description='公司全球组合披露；实际上市按单一市场核验',published='2026-01-15')],partners)
sam_us='https://www.samsungbioepis.com/kr/newsroom/newsroomView.do?currentPage=1&idx=605'
add('samsung','SB27','pembrolizumab','',sam_us,[
    g('—','III 期',SAM,published='2026-01-15'),
    g('KR','已提交上市申请',sam_us,'2026-08'),g('US','已提交上市申请',sam_us,'2026-10-30')])
sam_oct='https://www.samsungepisholdings.com/en/newsroom/newsroomView.do?idx=605'
for molecule in ['dupilumab','guselkumab','ixekizumab','vedolizumab','ocrelizumab','trastuzumab deruxtecan','benralizumab','canakinumab']:
    source = sam_oct if molecule in ['benralizumab','canakinumab'] else SAM
    partner = [relation('Teva','合作开发与商业化','美国、欧洲等协议市场',sam_oct)] if source==sam_oct else []
    add('samsung','samsung-'+molecule.replace(' ','-'),molecule,'',source,
        [g('—','项目已披露' if partner else '早期研发',source)],partner,display=molecule.title()+' · '+NO_CODE)
ledger('samsung','11 款已商业化产品 · 10 个分子（2026-01）',19,'10 个商业化资产与 9 个已披露后续资产；SB16 两种参照剂型同一代号','早期项目未公开的研发代号与各市场时间表仅在取得公告后录入。',SAM)

# Celltrion's current company pipeline plus its named marketed/approved asset portfolio.
cell_cd = [
 ('CT-P13','infliximab','Remsima|Remsima SC|Inflectra|Zymfentra'),
 ('CT-P6','trastuzumab','Herzuma'),
 ('CT-P10','rituximab','Truxima|Ritemvia|Rituzena (previously Tuxella)|Blitzima'),
 ('CT-P17','adalimumab','Yuflyma'),
 ('CT-P16','bevacizumab','Vegzelma'),
 ('CT-P39','omalizumab','Omlyclo'),
 ('CT-P41','denosumab','Stoboclo|Osenvelt'),
 ('CT-P42','aflibercept','Eydenzelt'),
 ('CT-P43','ustekinumab','Steqeyma|Qoyvolma'),
 ('CT-P47','tocilizumab','Avtozma'),
]
for code,molecule,aliases in cell_cd:
    add('celltrion',code,molecule,aliases,CELL_PORT)
for code,molecule in [('CT-P44','daratumumab'),('CT-P51','pembrolizumab'),('CT-P53','ocrelizumab'),('CT-P55','secukinumab')]:
    events=[g('—','III 期',CELL,description='公司管线页列示阶段')]
    add('celltrion',code,molecule,'',CELL,events)
ledger('celltrion','官网临床管线列 4 项',14,'官网 4 项临床管线加 10 个已具名商业或获批资产','CT-P52／依奇珠单抗未见于所核对的在研页，继续查证官方项目身份。Remsima SC 单独按剂型备注。',CELL)

# Biocon's publicly named molecules, preserving undisclosed projects at aggregate level.
biocon_codes = [
 ('biocon-pegfilgrastim','pegfilgrastim','Fulphila'),
 ('biocon-trastuzumab','trastuzumab','Ogivri|Hertraz'),
 ('biocon-bevacizumab','bevacizumab','Abevmy|Jobevne'),
 ('biocon-adalimumab','adalimumab','Hulio'),
 ('biocon-etanercept','etanercept','Nepexto'),
 ('biocon-ustekinumab','ustekinumab','Yesintek'),
 ('biocon-glargine-u100','insulin glargine','Semglee|Basalog'),
 ('biocon-human-insulin','human insulin','Insugen'),
 ('biocon-aspart','insulin aspart','Kirsty|Kixelle'),
 ('biocon-aflibercept','aflibercept','Yesafili'),
]
for code,molecule,aliases in biocon_codes:
    add('biocon',code,molecule,aliases,BICON,[g('—','获批／商业化组合',BICON)],
        display=aliases.split('|')[0] or molecule.title()+' · '+NO_CODE,developer='Biocon 公开组合')
bdm='https://www.bioconbiologics.com/biocon-biologics-receives-u-s-food-and-drug-administration-approval-for-bosaya-and-aukelso-denosumab-biosimilars/'
add('biocon','biocon-denosumab','denosumab','Bosaya|Aukelso',bdm,[g('US','获批',bdm)],display='Bosaya／Aukelso')
for code,molecule,stage in [('biocon-pertuzumab','pertuzumab','后期研发'),('biocon-glargine-u300','insulin glargine','临床前')]:
    add('biocon',code,molecule,'',BICON,[g('—',stage,BICON)],display='Glargine U300 · '+NO_CODE if code.endswith('u300') else 'Pertuzumab · '+NO_CODE)
ledger('biocon','10 个获批或商业化分子（官网产品页）',15,'产品页 10 个分子、公开后期和早期项目与已宣布的 PD-1 资产','官网早期组合另列 7 个未披露项目。地舒单抗以 FDA 批准更新官网组合阶段。',BICON)

# Alvotech public program labels distinguish different strengths and routes.
alvo_rows = [
 ('AVT02','adalimumab','Simlandi|Hukyndra','已商业化','US EU CA AU SA IL EG ZA MA PE BO'),
 ('AVT03','denosumab','','已商业化','JP EU UK'),
 ('AVT04','ustekinumab','Selarsdi|Uzpruvo|Jamteki','已商业化','US JP CA EU'),
 ('AVT05','golimumab','Gobivaz','已商业化','JP EU UK'),
 ('AVT06','aflibercept','Mynzepli|Afiveg','','JP EU UK'),
 ('AVT23','omalizumab','','获批','UK'),
 ('AVT16','vedolizumab','','已提交上市申请',''),
 ('AVT80','vedolizumab','','审评',''),
 ('AVT29','aflibercept','','临床',''),
 ('AVT32','pembrolizumab','','临床前',''),
 ('AVT10','certolizumab pegol','','临床前',''),
 ('AVT28','ixekizumab','','早期研发',''),
 ('AVT48','canakinumab','','早期研发',''),
 ('AVT41','guselkumab','','早期研发',''),
 ('AVT65','ofatumumab','','早期研发',''),
 ('AVT19','dupilumab','','早期研发',''),
 ('AVT87','emicizumab','','早期研发',''),
 ('AVT34','durvalumab','','早期研发',''),
]
for code,molecule,aliases,stage,approved in alvo_rows:
    milestones=market_set(ALVO,'获批',approved)
    if stage and not (code=='AVT23'):
        milestones.append(g('—',stage,ALVO,description='公司管线展示的总体进展'))
    partners=[]
    detail={'AVT06':'Eylea 2 mg','AVT29':'Eylea HD 8 mg','AVT16':'静脉制剂（IV）',
            'AVT80':'皮下制剂（SC）','AVT04':'Stelara 参照项目'}.get(code)
    if code in ['AVT05','AVT06']:
        milestones.extend([g('US','BLA 重新提交',ALVO_RE,'2026-06')])
    if code=='AVT16':
        avt16_us='https://www.alvotech.com/newsroom/alvotech-announces-fda-acceptance-of-biologics-license-application-for-avt16-a-proposed-interchangeable-biosimilar-to-entyvio'
        milestones.append(g('US','审评',avt16_us,'2026-06-08','FDA 受理静脉制剂 BLA'))
    if code=='AVT80':
        milestones.append(g('US','审评',ALVO80,description='FDA 受理皮下制剂 BLA'))
        partners.append(relation('Teva','商业化授权','US',ALVO80))
    if code=='AVT29':
        milestones.append(g('EU','已提交上市申请',ALVO_NOV,description='Advanz Pharma 与公司向 EMA 递交申请',published='2026-11-11'))
        partners.append(relation('Advanz Pharma','共同申报与商业化','EU',ALVO_NOV))
    if code in ['AVT87','AVT34']:
        partners.append(relation('Lotus Pharmaceuticals','区域商业化；Alvotech 保留美国共同销售权','US 与部分亚洲市场',ALVO_NOV))
    if code=='AVT23':
        partners.append(relation('Kashiv BioSciences','开发与区域商业化合作','约定市场',
            'https://www.alvotech.com/newsroom/alvotech-enters-into-exclusive-licensing-agreement-with-kashiv-biosciences-for-development-and-commercialization-of-a-proposed-biosimilar-to-xolair-omalizumab'))
    if code=='AVT06':
        settlement='https://investors.alvotech.com/news-releases/news-release-details/alvotech-and-teva-secure-us-settlement-date-avt06-proposed'
        milestones.append(record('US','和解许可的上市窗口',settlement,'2026 Q4',
            '须获 FDA 批准，协议允许特定情况下提前。',published='2025-12-19',expected=True))
        partners.append(relation('Teva','美国商业化','US',settlement))
        partners.append(relation('Advanz Pharma','欧洲商业化','约定欧洲市场',
            'https://www.alvotech.com/newsroom/alvotech-and-advanz-pharma-sign-commercialization-agreement-for-proposed-biosimilar-to-eylea-ld-hd-in-europe'))
    add('alvotech',code,molecule,aliases,ALVO,milestones,partners,note=detail)
ledger('alvotech','官网 18 个公开项目',18,'全部 18 个项目；AVT16/80 和 AVT06/29 按制剂或规格分别维护','官网阶段与后续公告有差异时依据具体司法辖区公告。部分早期项目无可核验里程碑日期。',ALVO)

# Sandoz product observations and audited marketing roles for acquired or licensed assets.
sandoz_rows = [
 ('GP2017','adalimumab','Hyrimoz|Hefiya|Halimatoz',''),
 ('GP2015','etanercept','Erelzi',''),
 ('GP1111','infliximab','Zessly',''),
 ('GP2013','rituximab','Rixathon|Riximyo',''),
 ('sandoz-filgrastim','filgrastim','Zarzio|Zarxio|Filgrastim Hexal',''),
 ('sandoz-epoetin','epoetin alfa','Binocrit|Epoetin Alfa Hexal',''),
 ('sandoz-somatropin','somatropin','Omnitrope',''),
 ('sandoz-pegfilgrastim','pegfilgrastim','Ziextenzo',''),
 ('sandoz-denosumab','denosumab','Jubbonti|Wyost',''),
 ('sandoz-natalizumab','natalizumab','Tyruko','Polpharma Biologics'),
 ('sandoz-ranibizumab','ranibizumab','Cimerli','Bioeq / Formycon'),
 ('sandoz-aflibercept','aflibercept','Enzeevu|Afqlir',''),
 ('sandoz-trastuzumab','trastuzumab','Herwenda',''),
]
for code,molecule,aliases,developer in sandoz_rows:
    add('sandoz',code,molecule,aliases,SAND_PORT,display=aliases.split('|')[0],
        developer=developer or None)
ledger('sandoz','13 个已上市分子 · 40 项管线资产（2026-09）',None,
    '已逐项核对公开产品及具名商业合作，产品统计与公司研发总量的口径不同',
    '公司披露的组合总量包含未具名项目。管线只列有可识别对象与公开出处的项目。',SAND_CMD)

register['biocon-etanercept']['milestones'].append(g('AU','已商业化',
 'https://www.bioconbiologics.com/biocon-biologics-launches-nepexto-a-biosimilar-to-enbrel-etanercept-in-australia/'))
register['HLX02'] = dict(id='HLX02',company='henlius',molecule='trastuzumab',
    names=['汉曲优','Hercessi','Zercepac'],source=HEN,display='HLX02',developer=None,description=None,
    milestones=market_set(HEN,'已商业化','CN US EU'),partners=[
      relation('Accord Healthcare','区域商业化','EU',HEN),
      relation('Accord BioPharma','区域商业化','US',HEN)])
# Additional events confirmed in Henlius' November investor materials.
add('henlius','HLX1102','dupilumab','',HEN_SLIDES,[
    g('—','项目已披露',HEN_SLIDES,description='投资者材料具名披露，现阶段待核。')])
register['HLX11']['names'].append('汉贝优')
register['HLX11']['milestones'].extend([
    g('CN','获批',HEN_SLIDES,description='公司投资者材料披露中国批准'),
    g('CA','审评',HEN_SLIDES,description='加拿大上市申请在审')])
register['HLX14']['milestones'].append(g('CN','审评',HEN_SLIDES,description='中国 60 mg/mL 规格另有在审申请'))
register['HLX04-O']['milestones'].append(g('CN','审评',HEN_SLIDES,description='中国上市申请在审'))
add('henlius','HLX13','ipilimumab','',HEN_SLIDES,[
    g('US','I 期',HEN,description='美国 I 期试验')],
    [relation('Sandoz','已披露合作方','协议约定市场',HEN_SLIDES,'sandoz')])
add('henlius','HLX15','daratumumab','',HEN_SLIDES,[
    g('—','I 期',HEN_SLIDES,description='皮下制剂关键 PK 研究')],
    [relation("Dr. Reddy’s",'已披露合作方','协议约定市场',HEN_SLIDES)])
add('henlius','HLX01','rituximab','汉利康',HEN_SLIDES,[g('CN','已商业化',HEN_SLIDES)],
    [relation('复星医药','合作商业化','CN',HEN_SLIDES)])
add('henlius','HLX03','adalimumab','汉达远',HEN_SLIDES,[g('CN','已商业化',HEN_SLIDES)])
add('henlius','HLX04','bevacizumab','汉贝泰',HEN_SLIDES,[g('CN','已商业化',HEN_SLIDES)],
    [relation('Eurofarma','已披露合作方','约定拉美市场',HEN_SLIDES)])
avt03_ep='https://www.alvotech.com/newsroom/alvotech-announces-approval-of-avt03-a-biosimilar-to-prolia-and-xgeva-denosumab-in-the-european-economic-area'
register['AVT03']['names'].extend(['Kefdensis','Zvogra','Acvybra'])
register['AVT03']['partners'].extend([
    relation('STADA','合作商业化','约定欧洲市场',avt03_ep),
    relation("Dr. Reddy’s",'合作商业化','US 与约定欧洲市场',avt03_ep)])
register['AVT03']['milestones'].append(g('US','BLA 重新提交',
   'https://www.alvotech.com/newsroom/alvotech-announces-financial-results-for-the-first-half-of-2026-and-provides-a-business-update',
   description='公司 2026 年中报披露向 FDA 重新提交 BLA'))
register['CT-P13']['description']='静脉 Remsima／Inflectra。不同剂型的批准以各地区药品说明书核验。'
for code, locations in [('CT-P13','EU US KR'),('CT-P10','EU US KR'),('CT-P6','EU US KR'),
  ('CT-P17','EU US KR'),('CT-P16','EU US KR'),('CT-P39','EU US KR'),('CT-P41','EU US KR'),
  ('CT-P42','EU KR US'),('CT-P43','EU US KR'),('CT-P47','EU US KR')]:
    register[code]['milestones'].extend(market_set(CELL_PORT,'获批',locations))
ctp55_filing='https://www.celltrion.com/ko-kr/company/media-center/press-release/4861'
register['CT-P55']['milestones'].extend([
    g('EU','III 期','https://www.celltrion.com/ko-kr/company/media-center/press-release/4464',
      '2026-02-09','III 期试验方案变更获批',published='2026-02-11'),
    g('EU','已提交上市申请',ctp55_filing,'2026-07-24',published='2026-07-24'),
    g('KR','已提交上市申请',ctp55_filing,published='2026-07-24'),
    g('CA','已提交上市申请',ctp55_filing,published='2026-07-24')])
register['AVT03']['names'].append('Xbonzy')

ophthalmology='https://www.sandoz.com/us-en/sandoz-launches-enzeevu-us-and-announces-key-private-label-agreement-expanding-treatment-choice/'
register['sandoz-aflibercept']['source']=ophthalmology
register['sandoz-aflibercept']['milestones'].extend([
    g('EU','已商业化',ophthalmology,'2025','Afqlir'),
    g('US','已商业化',ophthalmology,'2026-11','Enzeevu')])
