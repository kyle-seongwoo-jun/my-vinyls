
from models.record import Record
from babel.numbers import format_currency

class RecordGroups:
    def __init__(self, group_name: str):
        self.table: dict[str, list[Record]] = {}
        self.group_name = group_name
    
    def generate_group_key(self, record: Record) -> str:
        group = getattr(record, self.group_name, None)
        if group is None:
            return 'N/A'
        
        # get the year from purchase_date
        if self.group_name == 'purchase_date':
            group = group[:4] if len(group) >= 4 else 'N/A'

        # get range from purchase_price
        if self.group_name == 'purchase_price':
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

    def add(self, record: Record):
        group = self.generate_group_key(record)
        if group not in self.table:
            self.table[group] = []
        self.table[group].append(record)

    def add_all(self, records: list[Record]):
        for record in records:
            self.add(record)

    def sort_by(self, group_order: str):
        self.table = dict(sorted(
            self.table.items(), 
            # natural sort (https://stackoverflow.com/a/31432964) for purchase_price
            key=lambda x: '{0:0>12}'.format(x[0]).lower() if self.group_name == 'purchase_price' else x[0],
            reverse=group_order == 'descending',
        ))

    def items(self):
        return self.table.items()
    
    def values(self):
        return self.table.values()
    
    @property
    def length(self):
        return len(self.table)

    @property
    def sortable(self):
        return self.group_name != 'none' and self.length > 1
