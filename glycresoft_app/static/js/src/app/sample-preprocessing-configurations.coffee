samplePreprocessingPresets = [
    {
        name: "MS Glycomics Profiling"
        max_charge: 9
        ms1_score_threshold: 35
        ms1_averagine: "glycan"
        max_missing_peaks: 3
        msn_score_threshold: 10
        msn_averagine: 'glycan'
        fit_only_msn: false
    }
    {
        name: "LC-MS/MS Glycoproteomics"
        max_charge: 12
        max_missing_peaks: 3
        ms1_score_threshold: 35
        ms1_averagine: "glycopeptide"
        msn_score_threshold: 10
        msn_averagine: 'peptide'
        fit_only_msn: true
    }
]

setSamplePreprocessingConfiguration = (name) ->
    found = false
    for config in samplePreprocessingPresets
        if config.name == name
            found = true
            break
    console.log(found, config)
    if not found
        return
    form = $("form#add-sample-form")
    console.log(form)
    form.find("#maximum-charge-state").val(config.max_charge)
    form.find("#missed-peaks").val(config.max_missing_peaks)
    form.find('#ms1-minimum-isotopic-score').val(config.ms1_score_threshold)
    form.find('#ms1-averagine').val(config.ms1_averagine)
    if config.msn_score_threshold?
        form.find('#msn-minimum-isotopic-score').val(config.msn_score_threshold)
    if config.msn_averagine?
        form.find('#msn-averagine').val(config.msn_averagine)
    if config.fit_only_msn?
        form.find("#msms-features-only").prop("checked", config.fit_only_msn)


makePresetSelector = (container) ->
    label = $("<label for='preset-configuration'>Preset Configurations</label>")
    container.append(label)
    elem = $('''<select class='browser-default' name='preset-configuration'></select>''')
    for preset in samplePreprocessingPresets
        elem.append($("<option value='#{preset.name}'>#{preset.name}</option>"))
    container.append(elem)
    elem.change (event) ->
        console.log(@, arguments)
        setSamplePreprocessingConfiguration @value
