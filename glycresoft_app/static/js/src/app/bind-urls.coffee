ActionBook =
    home:
        container: '#home-layer'
        name: 'home-layer'
        closeable: false
    addSample:
        contentURL: '/add_sample'
        name: 'add-sample'
    glycanCompositionSearch:
        contentURL: '/search_glycan_composition/run_search'
        name: 'search-glycan-composition'
    glycopeptideSequenceSearch:
        contentURL: '/search_glycopeptide_sequences/run_search'
        name: "search-glycopeptide-sequences"
    naiveGlycopeptideSearchSpace:
        contentURL: "/glycopeptide_search_space"
        name: "glycopeptide-search-space"
    naiveGlycanSearchSpace:
        contentURL: "/glycan_search_space"
        name: "glycan-search-space"
    viewAnalysis:
        contentURLTemplate: "/view_analysis/{analysis_id}"
        name: "view-analysis"
        method: "post"
    viewHypothesis:
        contentURLTemplate: "/view_hypothesis/{uuid}"
        method: "post"
    viewSample:
        contentURLTemplate: "/view_sample/{sample_id}"
        method: 'get'


makeAPIGet = (url) -> (callback) -> $.get(url).success(callback)
makeParameterizedAPIGet = (url) -> (params, callback) -> $.get(url.format(params)).success(callback)

HypothesisAPI =
    all: makeAPIGet("/api/hypotheses")
    get: makeParameterizedAPIGet("/api/hypotheses/{}")

SampleAPI = 
    all: makeAPIGet("/api/samples")

AnalysisAPI = 
    all: makeAPIGet("/api/analyses")

TaskAPI =
    all: makeAPIGet("/api/tasks")


ErrorLogURL = "/log_js_error"


User =
    get: makeAPIGet("/users/current_user")
    set: (user_id, callback) -> $.post("/users/login", {"user_id": user_id}).success(callback)


MassShiftAPI = 
    all: makeAPIGet("/api/mass-shift")
