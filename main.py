from utils.components import RecordGroup
from utils.streamlit_util import remove_streamlit_style
from utils.collection_util import group_and_count, group_and_sum
from babel.numbers import format_currency
from models.record import Record
from typing import Optional
from operator import attrgetter
import streamlit as st

RECORDS_LIST_FILE = 'list.json'

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


    def generate_summary_string(self, group_name: Optional[str] = None):
        total_count_by_format = group_and_count([record.format for record in self.data])
        total_count_by_format_as_string = "".join([f"{count} {format}s, " for format, count in total_count_by_format.items()])[:-2]

        if group_name in ['purchase_price', 'purchase_date', 'purchase_location']:
            total_price_by_currency = group_and_sum([record.purchase_price for record in self.data if record.purchase_price is not None])
            total_price_by_currency_as_string = "".join([f"{format_currency(price, currency)}, " for currency, price in total_price_by_currency.items()])[:-2]
        else:
            total_price_by_currency_as_string = ''

        return f'Totally {total_count_by_format_as_string}' + (f' and {total_price_by_currency_as_string}' if total_price_by_currency_as_string else '')


    def genenerate_group_key(self, record: Record, group_name: str) -> str:
        group = getattr(record, group_name, None)
        if group is None:
            return 'N/A'

        # get the year from purchase_date
        if group_name == 'purchase_date':
            group = group[:4] if len(group) >= 4 else 'N/A'

        # get range from purchase_price
        if group_name == 'purchase_price':
            # 10, 20, ..., 100, 200, ..., 1000, 2000, ..., 10000, 20000, ..., 100000, 200000, ..., 1000000
            max_digit = 6 # 1,000,000
            ranges = [ 
                x 
                for digit in range(1, max_digit+1) 
                for x in range(10**digit, 10**(digit+1), 10**digit) 
            ] + [ 10**max_digit ]
            
            currency, price = group
            if price < ranges[0]:
                group = f'~ {format_currency(10, currency)}'
            else:
                for i in range(len(ranges) - 1):
                    if price < ranges[i+1]:
                        group = f'{format_currency(ranges[i], currency)} ~'
                        break
                else:
                    group = f'{format_currency(ranges[-1], currency)} ~'
    
        return group
    
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

        group_by = {
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


        search_param = st.query_params.get('search', '')
        group_param = st.query_params.get('group', 'format')
        order_param = st.query_params.get('order', 'ascending')

        search = self.filter.text_input('search', 
                                        key='search', 
                                        value=search_param, 
                                        on_change=lambda: self.update_query_params())
        
        group_name = self.options.radio('group by',
                                        key='group',
                                        options=list(group_by.keys()),
                                        index=list(group_by.keys()).index(group_param),
                                        on_change=lambda: self.update_query_params())
        
        group_info = group_by[group_name]
        sort_by = group_info.get('sort_by')
    
        # filter and sort records from list.json by options
        records = [
            record 
            for record in self.data 
            if search.lower() in str(record).lower()
        ] if search else self.data
        # TODO: sort only the first attribute in descending order and the rest in ascending order
        need_reverse = (group_name == 'purchase_date' or group_name == 'purchase_price') and order_param == 'descending'
        records = sorted(records, key=attrgetter(*sort_by), reverse=need_reverse)

        # group by options
        table = {}
        for record in records:
            group = self.genenerate_group_key(record, group_name)
            if group not in table:
                table[group] = []
            table[group].append(record)

        # sort keys by options
        disable_order = group_name == 'none' or len(table) == 1
        group_order = self.options.radio('order', 
                                         options=['ascending', 'descending'], 
                                         index=['ascending', 'descending'].index(order_param), 
                                         key='order', 
                                         horizontal=True, 
                                         disabled=disable_order,
                                         on_change=lambda: self.update_query_params())
        table = dict(sorted(
            table.items(), 
            # natural sort (https://stackoverflow.com/a/31432964) for purchase_price
            key=lambda x: '{0:0>12}'.format(x[0]).lower() if group_name == 'purchase_price' else x[0],
            reverse=group_order == 'descending',
        ))

        # no records found
        if len(table) == 0:
            if search and len(search) > 0:
                st.error(f'No records found for "{search}"')
            else:
                st.info('No records found')

        # display records
        count = {}
        for group, records in table.items():
            st.write('---')
            if group_name != 'none':
                st.subheader(group)

            record_widget = RecordGroup(group_name)
            for record in records:
                record_widget.add_record(record)
                if record.format not in count:
                    count[record.format] = 0

                count[record.format] += 1

            record_widget.generate()

        # display summary
        if search:
            summary_string = f'Found {sum([len(records) for records in table.values()])} records for "{search}"'
        else:
            summary_string = self.generate_summary_string(group_name=group_name)
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
