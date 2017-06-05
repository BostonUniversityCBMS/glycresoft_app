from flask import has_request_context, abort, request

from math import ceil

try:
    range = xrange
except NameError:
    pass


# Variation on the Pagination class and methods found in Flask-SQLAlchemy


class PaginationBase(object):

    def __init__(self, source, page, per_page, total, items):
        self.source = source
        #: the current page number (1 indexed)
        self.page = page
        #: the number of items to be displayed on a page.
        self.per_page = per_page
        #: the total number of items matching the query
        self.total = total
        #: the items for the current page
        self.items = items

    def __repr__(self):
        return "{self.__class__.__name__}({self.page}, {self.per_page})".format(self=self)

    @property
    def pages(self):
        """The total number of pages"""
        if self.per_page == 0:
            pages = 0
        else:
            pages = int(ceil(self.total / float(self.per_page)))
        return pages

    @classmethod
    def paginate(cls, source, page, per_page, error_out, total=None):
        raise NotImplementedError()

    def prev(self, error_out=False):
        """Returns a :class:`Pagination` object for the previous page."""
        assert self.source is not None
        return self.paginate(self.source, self.page - 1, self.per_page, error_out, self.total)

    @property
    def prev_num(self):
        """Number of the previous page."""
        return self.page - 1

    @property
    def has_prev(self):
        """True if a previous page exists"""
        return self.page > 1

    def next(self, error_out=False):
        """Returns a :class:`Pagination` object for the next page."""
        assert self.source is not None
        return self.paginate(self.source, self.page + 1, self.per_page, error_out, self.total)

    @property
    def has_next(self):
        """True if a next page exists."""
        return self.page < self.pages

    @property
    def next_num(self):
        """Number of the next page"""
        return self.page + 1

    def iter_pages(self, left_edge=2, left_current=2,
                   right_current=5, right_edge=2):
        """Iterates over the page numbers in the pagination.  The four
        parameters control the thresholds how many numbers should be produced
        from the sides.  Skipped page numbers are represented as `None`.
        """
        last = 0
        for num in range(1, self.pages + 1):
            if num <= left_edge or \
               (num > self.page - left_current - 1 and
                num < self.page + right_current) or \
               num > self.pages - right_edge:
                if last + 1 != num:
                    yield None
                yield num
                last = num

    @property
    def first_item(self):
        try:
            return self.items[0]
        except IndexError:
            return None


class SequencePagination(PaginationBase):

    @classmethod
    def paginate(cls, sequence, page=None, per_page=None, error_out=True, total=None):
        if has_request_context():
            if page is None:
                try:
                    page = int(request.args.get('page', 1))
                except (TypeError, ValueError):
                    if error_out:
                        abort(404)

                    page = 1

            if per_page is None:
                try:
                    per_page = int(request.args.get('per_page', 20))
                except (TypeError, ValueError):
                    if error_out:
                        abort(404)

                    per_page = 20
        else:
            if page is None:
                page = 1

            if per_page is None:
                per_page = 20

        if error_out and page < 1:
            abort(404)

        start = (page - 1) * per_page
        items = sequence[slice(start, start + per_page)]
        if not items and page != 1 and error_out:
            abort(404)

        if total is None:
            total = len(sequence)

        return cls(sequence, page, per_page, total, items)


class QueryPagination(PaginationBase):

    @classmethod
    def paginate(cls, query, page=None, per_page=None, error_out=True, total=None):
        """Returns `per_page` items from page `page`.  By default it will
        abort with 404 if no items were found and the page was larger than
        1.  This behavor can be disabled by setting `error_out` to `False`.
        If page or per_page are None, they will be retrieved from the
        request query.  If the values are not ints and ``error_out`` is
        true, it will abort with 404.  If there is no request or they
        aren't in the query, they default to page 1 and 20
        respectively.
        Returns an :class:`Pagination` object.
        """

        if has_request_context():
            if page is None:
                try:
                    page = int(request.args.get('page', 1))
                except (TypeError, ValueError):
                    if error_out:
                        abort(404)

                    page = 1

            if per_page is None:
                try:
                    per_page = int(request.args.get('per_page', 20))
                except (TypeError, ValueError):
                    if error_out:
                        abort(404)

                    per_page = 20
        else:
            if page is None:
                page = 1

            if per_page is None:
                per_page = 20

        if error_out and page < 1:
            abort(404)

        items = query.limit(per_page).offset((page - 1) * per_page).all()

        if not items and page != 1 and error_out:
            abort(404)

        if total is None:
            # No need to count if we're on the first page and there are fewer
            # items than we expected.
            if page == 1 and len(items) < per_page:
                total = len(items)
            else:
                total = query.count()

        return cls(query, page, per_page, total, items)


Pagination = QueryPagination

paginate = QueryPagination.paginate
