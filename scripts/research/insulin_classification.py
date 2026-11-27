"""Public Part D classification reused from the insulin tracker."""
def classify(generic):
    generic=generic.casefold()
    if not generic.startswith("insulin ") or any(x in generic for x in ("syringe", "insulin pump", "insulin pmp", "insulin pen,", "insulin admin.")):
        return None
    if "lixisenatide" in generic or "liraglutide" in generic:
        return "胰岛素＋GLP-1"
    if "prot" in generic or "nph hum/reg" in generic:
        return "预混胰岛素"
    for prefix, molecule in [
        ("glargine", "甘精 Glargine"), ("aspart", "门冬 Aspart"), ("lispro", "赖脯 Lispro"),
        ("degludec", "德谷 Degludec"), ("detemir", "地特 Detemir"), ("glulisine", "谷赖 Glulisine"),
        ("regular", "人胰岛素 Human"), ("nph", "人胰岛素 Human"),
    ]:
        if generic.startswith("insulin "+prefix):
            return molecule
    raise ValueError(generic)
