identifyProteomicsFormat = (file, callback) ->
    isMzidentML = (lines) ->
        i = 0
        hit = false
        tag = []
        for line in lines
            if /mzIdentML/.test line
                hit = true
                break
            i += 1
        if hit
            console.log(hit)
            tag.push line[i]
            tag.push lines[i + 1]
            tag.push lines[i + 2]
            tag = tag.join(" ")
            hasVersion = /version="([0-9\.]+)"/.test tag
            if hasVersion
                match = /version="([0-9\.]+)"/.exec tag
                version = match[1]
                version = [parseInt(d) for d in version.split('.')]
                return {"version": version, "format": ProteomicsFileFormats.mzIdentML}
            else
                return {"format": ProteomicsFileFormats.mzIdentML}

        return false

    isMzML = (lines) ->
        i = 0
        hit = false
        tag = []
        for line in lines
            if /(mzML)|(indexedmzML)/.test line
                hit = true
                break
            i += 1
        if hit
            return {"format": ProteomicsFileFormats.error}
        return false

    reader = new FileReader()
    reader.onload = ->
        lines = @result.split("\n")
        proteomicsFileType = {"format": ProteomicsFileFormats.fasta}
        test = isMzML(lines)
        if test
            proteomicsFileType = test
        test = isMzidentML(lines)
        if test
            proteomicsFileType = test
        callback(proteomicsFileType)
    reader.readAsText(file.slice(0, 100))


ProteomicsFileFormats = {
    mzIdentML: "mzIdentML"
    fasta: "fasta"

    error: "error"
}


getProteinName = (sequence) ->
    for line in sequence.split("\n")
        parts = line.split /(<DBSequence)/g
        i = 0
        chunk = null
        for part in parts
            if /<DBSequence/.test part
                chunk = parts[i + 1]
                break
            i += 1
        if chunk?
            id = /accession="([^"]+)"/.exec chunk
            id = id[1]
            return id # id.split("_").slice(1).join("_")


getProteinNamesFromMzIdentML = (file, callback, nameCallback) ->
    fr = new FileReader()

    if !nameCallback?
        nameCallback = (name) ->
            console.log(name)
    chunksize = 1024 * 32
    offset = 0
    proteins = {}
    lastLine = ""
    isDone = false
    fr.onload = ->
        sequences = [lastLine].concat (@result).split /<\/DBSequence>/g
        i = 0
        for sequence in sequences
            if i == 0
                # console.log(sequence)
                i
            i += 1
            line = sequence
            try
                if /<DBSequence/i.test line
                    name = getProteinName(line)
                    if !name?
                        continue
                    if !proteins[name]
                        proteins[name] = true
                        nameCallback(name)
                else if /<\/SequenceCollection>/i.test line
                    isDone = true
                lastLine = ""
            catch error
                # console.log "Error while discovering protein names", error, offset, line
                lastLine = line
                # throw error

        seek()
    fr.onerror = (error) ->
        console.log "Error while loading proteins", error
    seek = ->
        if offset >= file.size or isDone
            callback Object.keys(proteins)
        else
            fr.readAsText(file.slice(offset, offset + chunksize))
            offset += chunksize / 2
    seek()


class MzIdentMLProteinSelector
    constructor: (file, listContainer) ->
        @fileObject = file
        @container = $(listContainer)
        @initializeContainer()

    clearContainer: ->
        @container.html("")

    initializeContainer: ->
        template = """
        <div class='display-control'>
            <a class='toggle-visible-btn right' data-open="open" style='cursor:hand;'>
                <i class="material-icons">keyboard_arrow_up</i>
            </a>
        </div>
        <div class='hideable-container'>
            <div class='row'>
                <div class='col s4'>
                    <div class='input-field'>
                        <input value='' name="protein-regex" type="text" class="validate protein-regex">
                        <label class="active" for="protein-regex">Protein Pattern</label>
                    </div>
                </div>
                <div class='col s2'>
                    <input type='checkbox' id='select-all-proteins-checkbox' name='select-all-proteins-checkbox'/>
                    <label for='select-all-proteins-checkbox'>Select All</label>
                </div>
                <div class='col s2' id='is-working'>
                    <span class="card-panel red">
                        Working
                    </span>
                </div>
            </div>
            <div class='row'>
                <div class='col s12 protein-name-list'>

                </div>
            </div>
        </div>
        """
        @container.html template
        @container.find(".hideable-container").click ".protein-name label", (event) ->
            target = event.target
            parent = $(target.parentElement)
            if parent.hasClass("protein-name")
                target.parentElement.querySelector("input").click()
        @hideableContainer = @container.find ".hideable-container"
        @regex = @container.find ".protein-regex"
        @list = @container.find ".protein-name-list"
        @toggleVisible = @container.find ".toggle-visible-btn"
        @selectAllChecker = @container.find '#select-all-proteins-checkbox'
        self = @

        @toggleVisible.click ->
            handle = $ @
            if handle.attr("data-open") == "open"
                self.hideableContainer.hide()
                handle.attr "data-open", "closed"
                handle.html '<i class="material-icons">keyboard_arrow_down</i>'
            else if handle.attr("data-open") == "closed"
                self.hideableContainer.show()
                handle.attr "data-open", "open"
                handle.html '<i class="material-icons">keyboard_arrow_up</i>'

        @regex.change (e) ->
            e.preventDefault()
            pattern = $(@).val()
            self.updateVisibleProteins pattern

        @regex.keydown (e) =>
            if(e.keyCode == 13)
                e.preventDefault();
                @regex.change()
                return false;

        @selectAllChecker.off()

        @selectAllChecker.click (e) =>
            callback = =>
                if @selectAllChecker.prop("checked")
                    @container.find(".protein-name-list input[type='checkbox'].protein-name-check:visible").prop("checked", true)
                    @selectAllChecker.prop("checked", true)
                else
                    @container.find(".protein-name-list input[type='checkbox'].protein-name-check:visible").prop("checked", false)
                    @selectAllChecker.prop("checked", false)
            requestAnimationFrame(callback)

        @load()

    createAddProteinNameToListCallback: ->
        regex = @regex
        callback = (name) =>
            pat = new RegExp(regex.val())
            template = $("""
            <p class="input-field protein-name">
                <input type="checkbox" name="#{name}" class="protein-name-check" />
                <label for="#{name}">#{name}</label>
            </p>
            """)
            if not pat.test(name)
                template.hide()
            @list.append template
        return callback

    updateVisibleProteins: (pattern) ->
        regex = new RegExp(pattern, 'i')
        $('.protein-name').each ->
            handle = $ @
            name = handle.find("input").attr("name")
            if regex.test name
                handle.show()
            else
                handle.hide()

    load: ->
        callback = @createAddProteinNameToListCallback()
        finalizeCallback = =>
            console.log("Finalizing!", arguments, @)
            template = """
            <span class="card-panel green">
                Done
            </span>
            """
            @container.find("#is-working").html(template)
        getProteinNamesFromMzIdentML(@fileObject, finalizeCallback, callback)

    getChosenProteins: ->
        return ($(a).attr("name") for a in @container.find("input.protein-name-check:checked"))

    getAllProteins: ->
        return ($(a).attr("name") for a in @container.find("input.protein-name-check"))
