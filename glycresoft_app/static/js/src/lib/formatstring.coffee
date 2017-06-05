do ->

    ###
    Implements {named} replacements similar to the simple format() method of strings from Python
    ###

    String::format = ->
        data = arguments
        i = 0
        keys = Object.keys(arguments)
        if arguments.length == 1 and typeof arguments[0] == 'object'
            data = arguments[0]
            keys = Object.keys(arguments)
        res = @replace(/\{([^\}]*)\}/g, (placeholder, name, position) ->
            if name == ''
                name = keys[i]
                i++
            # try
            v = JSON.stringify(data[name])
            # if v.length > 1
            if v.startsWith('"') and v.endsWith('"')
                v = v.slice(1, -1)
            return v
            # catch err   
            #     console.log err, name, data
            #     return undefined
            # return
        )
        res

    return
