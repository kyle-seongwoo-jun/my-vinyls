from utils.components import RecordGroup
from utils.streamlit_util import remove_streamlit_style
from utils.collection_util import group_and_count, group_and_sum
from babel.numbers import format_currency
from models.record import Record
from models.record_groups import RecordGroups
from typing import Optional
from operator import attrgetter
import streamlit as st

RECORDS_LIST_FILE = 'list.json'
CURRENCY_RATE = {
    'KRW': 1.0,
    'USD': 1450.0,
    'JPY': 9.5,
}
GROUP_BY = {
    'artist': {'sort_by': ['year', 'title'], },
    'genre': {'sort_by': ['artist', 'year'], },
    'format': {'sort_by': ['artist', 'year'], },
    'year': {'sort_by': ['artist', 'title'], },
    'country': {'sort_by': ['artist', 'year'], },
    'purchase_price': {'sort_by': ['purchase_price', 'purchase_date'], },
    'purchase_date': {'sort_by': ['purchase_date', 'artist', 'year'], },
    'purchase_location': {'sort_by': ['purchase_date', 'artist', 'year'], },
    'none': {'sort_by': ['artist', 'year'], },
}

class App:
    def __init__(self):
        self.data = None
        try:
            list_file = open(RECORDS_LIST_FILE, 'r')
            true = True
            false = False
            null = None
            record_list = eval(list_file.read())
            self.data: list[Record] = [Record(**record) for record in record_list]
            self.data = self.migrate_currency(self.data)
            list_file.close()
        except FileNotFoundError:
            st.error(f'File "{RECORDS_LIST_FILE}" not found')
            st.write('')
            st.write("Did you fork this template just now? If so, you need to upload your list file first.")
            st.code('''
            # Path: list.json
            [
                {
                    "cover": "<image_url>",
                    "artist": "<artist_name>",
                    "title": "<album_title>",
                    "genre": "<genre>",
                    "format": "<format>",
                    "country": "<country>",
                    "year": <year>
                },
                ...
            ]
            ''', language='json')
        except Exception:
            st.error(f'Wrong JSON format in "{RECORDS_LIST_FILE}". Please check the file and try again.')
        finally:
            if not isinstance(self.data, list):
                st.write("For more information, please check the [documentation](https://github.com/BayernMuller/vinyl/blob/main/README.md).")
                st.stop()

        self.filter = st.sidebar.expander('filter', expanded=True)
        self.options = st.sidebar.expander('options', expanded=True)

    def migrate_currency(self, records: list[Record]):
        for record in records:
            if record.purchase is not None and record.purchase.currency != 'KRW':
                record.purchase.price = record.purchase.price * CURRENCY_RATE[record.purchase.currency]
                record.purchase.currency = 'KRW'
        return records

    def generate_summary_string(self, records: list[Record], include_price: bool = False, sub_header: bool = False):
        total_count_by_format = group_and_count([record.format for record in records])
        total_count_by_format_as_string = "".join([f"{count} {format}s, " for format, count in total_count_by_format.items()])[:-2]

        if include_price:
            total_price_by_currency = group_and_sum([record.purchase_price for record in records if record.purchase_price is not None])
            total_price_by_currency_as_string = "".join([f"{format_currency(price, currency)}, " for currency, price in total_price_by_currency.items()])[:-2]
        else:
            total_price_by_currency_as_string = ''

        if not sub_header:
            return f'Totally {total_count_by_format_as_string}' + (f' and {total_price_by_currency_as_string}' if total_price_by_currency_as_string else '')
        else:
            return '<div style="color: gray">' + ', '.join([
                value for value in [
                    total_count_by_format_as_string,
                    total_price_by_currency_as_string,
                ] if value
            ]) + '</div>'

    def create_record_groups(self, search: str, group_name: str, order_param: str) -> RecordGroups:
        # filter and sort records from list.json by options
        records = self.searched_and_sorted_records(search, group_name, order_param)

        record_groups = RecordGroups(group_name)
        record_groups.add_all(records)
        return record_groups

    def searched_and_sorted_records(self, search: str, group_name: str, order_param: str) -> list[Record]:
        sort_by = GROUP_BY[group_name].get('sort_by')
        # TODO: sort only the first attribute in descending order and the rest in ascending order
        need_reverse = (group_name == 'purchase_date' or group_name == 'purchase_price') and order_param == 'descending'

        # filter
        records = [
            record 
            for record in self.data 
            if search.lower() in str(record).lower()
        ] if search else self.data

        # sort
        records = sorted(records, key=attrgetter(*sort_by), reverse=need_reverse)

        return records

    def update_query_params(self):
        st.query_params = dict(
            search=st.session_state.get('search'),
            group=st.session_state.get('group'),
            order=st.session_state.get('order'),
        )

    def clear_query_params(self):
        st.query_params = {}

    def run(self):
        st.title('Records')
        summary = st.empty()

        # get query params
        search_param = st.query_params.get('search', '')
        group_param = st.query_params.get('group', 'format')
        order_param = st.query_params.get('order', 'ascending')

        # sidebar
        search = self.filter.text_input('search', 
                                        key='search', 
                                        value=search_param, 
                                        on_change=lambda: self.update_query_params())

        group_name = self.options.radio('group by',
                                        key='group',
                                        options=list(GROUP_BY.keys()),
                                        index=list(GROUP_BY.keys()).index(group_param),
                                        on_change=lambda: self.update_query_params())

        # search, sort, and group records by options
        record_groups = self.create_record_groups(search, group_name, order_param)

        # sort groups by options
        group_order = self.options.radio('order', 
                                         options=['ascending', 'descending'], 
                                         index=['ascending', 'descending'].index(order_param), 
                                         key='order', 
                                         horizontal=True, 
                                         disabled=not record_groups.sortable,
                                         on_change=lambda: self.update_query_params())
        record_groups.sort_by(group_order)

        # no records found
        if record_groups.length == 0:
            if search and len(search) > 0:
                st.error(f'No records found for "{search}"')
            else:
                st.info('No records found')

        # display records
        count = {}
        for group, records in record_groups.items():
            st.write('---')
            if group_name != 'none':
                st.subheader(group)
                st.markdown(self.generate_summary_string(records,
                                                        include_price=group_name in ['artist', 'country', 'purchase_date', 'purchase_location'], 
                                                        sub_header=True), 
                            unsafe_allow_html=True)
                st.write('')

            record_widget = RecordGroup(group_name)
            for record in records:
                record_widget.add_record(record)
                if record.format not in count:
                    count[record.format] = 0

                count[record.format] += 1

            record_widget.generate()

        # display summary
        if search:
            summary_string = f'Found {sum([len(records) for records in record_groups.values()])} records for "{search}"'
        else:
            summary_string = self.generate_summary_string(self.data, include_price=group_name in ['purchase_price', 'purchase_date', 'purchase_location'])
        summary.markdown(summary_string)

        # clear filter and options
        st.sidebar.button('clear filter and options',
                        disabled=(search == '' and group_name == 'format' and order_param == 'ascending'),
                        on_click=lambda: self.clear_query_params())
            
        # display footer
        st.sidebar.divider()
        st.sidebar.write("Developed by [@BayernMuller](https://github.com/bayernmuller)")
        st.sidebar.write("Fork this template from [here](https://github.com/BayernMuller/vinyl/fork) and make your own list!")


if __name__ == '__main__':
    st.set_page_config(page_title='Records', page_icon=':cd:', layout='wide')
    remove_streamlit_style()
    app = App()
    app.run()
