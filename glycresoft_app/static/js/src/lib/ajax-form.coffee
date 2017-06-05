ajaxForm = (formHandle, success, error, transform, progress) ->
    if !progress?
        (ev) -> ev
    $(formHandle).on 'submit', (event) ->
        event.preventDefault()
        handle = $(this)
        locked = handle.data("locked")
        if locked == true
            return false
        else if locked == undefined or locked == null
            locked = true
            handle.data("locked", locked)
        else if locked == false
            locked = true
            handle.data("locked", locked)
        if !error?
            error = () ->
                console.log(arguments)
        if !transform?
            transform = (form) -> new FormData(form)
        url = handle.attr('action')
        method = handle.attr('method')
        data = transform(this)
        encoding = handle.attr('enctype') or 'application/x-www-form-urlencoded; charset=UTF-8'

        wrappedSuccess = (a, b, c) ->
            handle.data("locked", false)
            if success?
                success(a, b, c)

        wrappedError = (a, b, c) ->
            handle.data("locked", false)
            if error?
                error(a, b, c)       

        ajaxParams = 
            'xhr': ->
                xhr = new window.XMLHttpRequest()
                xhr.upload.addEventListener("progress", progress)
                xhr.addEventListener("progress", progress)
                return xhr
            'url': url
            'method': method
            'data': data
            'processData': false
            'contentType': false
            'success': wrappedSuccess
            'error': wrappedError
        $.ajax ajaxParams


setupAjaxForm = (sourceUrl, container) ->
    container = $(container)
    isModal = container.hasClass('modal')
    $.get(sourceUrl).success (doc) ->
        if isModal
            container.find('.modal-content').html doc
            container.openModal()
            container.find('form').submit (event) ->
                container.closeModal()
    
        else
            container.html doc
    container.find('script').each (i, tag) ->
        tag = $(tag)
        srcURL = tag.attr('src')
        if srcURL != undefined
            $.getScript srcURL
        else
            eval tag.text()
