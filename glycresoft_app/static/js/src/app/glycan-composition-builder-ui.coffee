# Depends on jQuery



class MonosaccharideInputWidgetGrid
    template: """
    <div class='monosaccharide-row row'>
        <div class='input-field col s2'>
            <label for='mass_shift_name'>Residue Name</label>
            <input class='monosaccharide-name center-align' type='text' name='monosaccharide_name' placeholder='Name'>
        </div>
        <div class='input-field col s2'>
            <label for='monosaccharide_mass_delta'>Lower Bound</label>
            <input class='lower-bound numeric-entry' min='0' type='number' name='monosaccharide_lower_bound' placeholder='Bound'>
        </div>
        <div class='input-field col s2'>
            <label for='monosaccharide_max_count'>Upper Bound</label>    
            <input class='upper-bound numeric-entry' type='number' min='0' placeholder='Bound' name='monosaccharide_upper_bound'>
        </div>
    </div>
    """

    constructor: (container)->
        @counter = 0
        @container = $(container)
        @monosaccharides = {}

    update: ->
        monosaccharides = {}
        for row in @container.find(".monosaccharide-row")
            row = $(row)
            entry = {
                name: row.find(".monosaccharide-name").val()
                lower_bound: row.find(".lower-bound").val()
                upper_bound: row.find(".upper-bound").val()
                # composition: row.find(".monosaccharide-composition").val()
            }
            if entry.name == ""
                # The empty row is never an error
                row.removeClass "warning"
                if row.data("tinyNotification")?
                    notif = row.data("tinyNotification")
                    notif.dismiss()
                    row.data("tinyNotification", undefined)
                continue
            if entry.name of monosaccharides
                # A duplicate row is always an error
                row.addClass "warning"
                pos = row.position()
                if row.data("tinyNotification")?
                    notif = row.data("tinyNotification")
                    notif.dismiss()
                notify = new TinyNotification(pos.top + 50, pos.left, "This residue is already present.", row)
                row.data("tinyNotification", notify)
            else
                # At this point, the row isn't a duplicate
                row.removeClass "warning"
                if row.data("tinyNotification")?
                    notif = row.data("tinyNotification")
                    notif.dismiss()
                    row.data("tinyNotification", undefined)
                monosaccharides[entry.name] = entry
                # Validate that the residue name is parsable. Use a continuation
                # function to isolate the DOM row.
                continuation = (gridRow) ->
                    $.post("/api/validate-iupac", {"target_string": entry.name}).then (validation, message, query) ->

                        if validation.valid
                            # The name must be valid, but may be a duplicate
                            if not (entry.name of monosaccharides)
                                # If not a duplicate, then remove all error
                                # states
                                gridRow.removeClass "warning"
                                if gridRow.data("tinyNotification")?
                                    notif = gridRow.data("tinyNotification")
                                    notif.dismiss()
                                    gridRow.data("tinyNotification", undefined)
                        else
                            # Otherwise, this is not a reasonable name, so
                            # set an error state
                            gridRow.addClass "warning"
                            pos = gridRow.position()
                            if gridRow.data("tinyNotification")?
                                notif = gridRow.data("tinyNotification")
                                notif.dismiss()
                            notify = new TinyNotification(pos.top + 50, pos.left, validation.message, gridRow)
                            gridRow.data("tinyNotification", notify)
                continuation(row)


        @monosaccharides = monosaccharides

    addEmptyRowOnEdit: (addHeader=false) ->
        row = $(@template)
        if !addHeader
            row.find("label").remove()
        @container.append(row)
        row.data("counter", ++@counter)
        self = @
        callback = (event) ->
            if row.data("counter") == self.counter
                self.addEmptyRowOnEdit(false)
            $(@).parent().find("label").removeClass("active")
        row.find("input").change callback
        row.find("input").change => @update()

    addRow: (name, lower, upper, composition, addHeader=false) ->
        row = $(@template)
        if !addHeader
            row.find("label").remove()
        @counter += 1
        row.find(".monosaccharide-name").val(name)
        row.find(".lower-bound").val(lower)
        row.find(".upper-bound").val(upper)
        # row.find(".monosaccharide-composition").val(composition)
        @container.append(row)
        row.find("input").change => @update()
        @update()


class ConstraintInputGrid
    template: """
    <div class="monosaccharide-constraints-row row">
        <div class='input-field col s2'>
            <label for='left_hand_side'>Limit</label>
            <input class='monosaccharide-name center-align' type='text' name='left_hand_side' placeholder='Name'>
        </div>
        <div class='input-field col s2' style='padding-left: 2px;padding-right: 2px;'>
            <select class='browser-default center-align' name='operator'>
                <option>=</option>
                <option>!=</option>
                <option>&gt;</option>
                <option>&lt;</option>
                <option>&gt;=</option>
                <option>&lt;=</option>
            </select>
        </div>
        <div class='input-field col s4 constrained-value-cell'>
            <label for='right_hand_side'>Constrained Value</label>
            <input class='monosaccharide-name constrained-value' type='text' name='right_hand_side' placeholder='Name/Value'>
        </div>
    </div>
    """

    constructor: (container, monosaccharideGrid)->
        @counter = 0
        @container = $(container)
        @constraints = []
        @monosaccharideGrid = monosaccharideGrid

    addEmptyRowOnEdit: (addHeader=false) ->
        row = $(@template)
        if !addHeader
            row.find("label").remove()
        @container.append(row)
        row.data("counter", ++@counter)
        self = @
        callback = (event) ->
            if row.data("counter") == self.counter
                self.addEmptyRowOnEdit(false)
            $(@).parent().find("label").removeClass("active")
        row.find("input").change callback
        row.find("input").change => @update()

    addRow: (lhs, op, rhs, addHeader=false) ->
        row = $(@template)
        if !addHeader
            row.find("label").remove()
        @counter += 1
        row.find("input[name='left_hand_side']").val(lhs)
        row.find("select[name='operator']").val(op)
        row.find("input[name='right_hand_side']").val(rhs)
        @container.append(row)
        row.find("input").change => @update()
        console.log(row)
        @update()

    update: ->
        constraints = []
        for row in @container.find(".monosaccharide-constraints-row")
            row = $(row)

            console.log(row)
            entry = {
                lhs: row.find("input[name='left_hand_side']").val()
                operator: row.find("select[name='operator']").val()
                rhs: row.find("input[name='right_hand_side']").val()
            }

            if entry.lhs == "" or entry.rhs == ""
                continue

            constraints.push(entry)
        console.log(constraints)
        @constraints = constraints
