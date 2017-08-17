class TabViewBase
    tabSelector: ""
    tabList: []
    defaultTab: ""
    updateUrl: ""
    indicatorColor: 'indigo'
    containerSelector: ""

    constructor: (@updateHandlers) ->
        @activeTab = @getLastActiveTab()

    getLastActiveTab: ->
        if GlycReSoft.context['view-active-tab']?
            return GlycReSoft.context['view-active-tab']
        else
            return @defaultTab

    getUpdateUrl: ->
        @updateUrl

    setupTabs: ->
        tabs = $ @tabSelector
        tabs.tabs()

        tabs.tabs 'select_tab', @getLastActiveTab()
        # Set the color scheme
        tabs.find('.indicator').addClass @indicatorColor
        # Update the current context if a tab is clicked. This fires in addition
        # to the tab-change handler
        tabs.find('.tab a').click ->
            GlycReSoft.context['view-active-tab'] = $(this).attr('href').slice(1)

    updateView: ->
        GlycReSoft.ajaxWithContext(@getUpdateUrl()).success((doc) =>
            handle = $ @containerSelector
            handle.html doc
            @setupTabs()
            for updateHandler in @updateHandlers
                updateHandler()
        ).error (err) ->
            console.log err
