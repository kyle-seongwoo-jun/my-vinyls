
from models.record import Record
from babel.numbers import format_currency
from typing import Any, Iterable, List, Tuple

class RecordGroups:
    def __init__(self, group_name: str):
        self.table: dict[str, list[Record]] = {}
        self.group_keys: dict[str, str] = {}
        self.group_name = group_name
    
    def generate_group_key(self, record: Record) -> List[Tuple[Any, str]]:
        group = getattr(record, self.group_name, None)
        if group is None:
            group = 'N/A'
        
        # remove article from artist name
        if self.group_name == 'artist':
            return [(group.replace('The ', ''), group)]
        
        # genres or styles
        if self.group_name == 'genres' or self.group_name == 'styles':
            return [(x, x) for x in group]

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
            return [(price, group)]
    
        return [(group, group)]

    def add(self, record: Record):
        group_keys = self.generate_group_key(record)

        # save keys for sorting
        for group_key, display_name in group_keys:
            self.group_keys[display_name] = group_key
        
        # add record to group
        for group_key, display_name in group_keys:
            if display_name not in self.table:
                self.table[display_name] = []
            self.table[display_name].append(record)

    def add_all(self, records: list[Record]):
        for record in records:
            self.add(record)

    def sort_by(self, group_order: str):
        self.table = dict(sorted(
            self.table.items(), 
            key=lambda x: self.group_keys[x[0]],
            reverse=group_order == 'descending',
        ))

    def items(self) -> Iterable[tuple[str, list[Record]]]:
        return self.table.items()
  
    @property
    def length(self) -> int:
        return len(self.table)
    
    @property
    def total_length(self) -> int:
        return sum([len(records) for records in self.table.values()])

    @property
    def sortable(self) -> bool:
        return self.group_name != 'none' and self.length > 1
