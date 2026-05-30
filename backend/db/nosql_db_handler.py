from motor.motor_asyncio import AsyncIOMotorClient


from .coredb.exceptions import AbsentTableException
from .coredb.wrappers import to_serializable

import os

MONGO_USER = os.environ.get("MONGO_INITDB_ROOT_USERNAME")
MONGO_PASSWORD = os.environ.get("MONGO_INITDB_ROOT_PASSWORD")
MONGO_HOST = os.environ.get("MONGOHOST")
MONGO_PORT = int(os.environ.get("MONGOPORT"))
MONGO_AUTH_DB = os.environ.get("MONGOUSER")

print(MONGO_USER, MONGO_PASSWORD, MONGO_HOST, MONGO_PORT, MONGO_AUTH_DB)

# Local connection
client = AsyncIOMotorClient(
    host=MONGO_HOST,
    port=MONGO_PORT,
    username=MONGO_USER,
    password=MONGO_PASSWORD,
    authSource=MONGO_AUTH_DB
)

way_guider = client["way_guider"]

class SQL_JOIN:
    table1 = None
    table2 = None
    sql_type = "INNER"
    first = False

    def __init__(self, table1, table2, sql_type="INNER", first=False):
        self.table1 = table1
        self.table2 = table2
        self.sql_type = sql_type
        self.first = first

    def __str__(self):
        return f'{self.table1} {self.sql_type} JOIN {self.table2} ON {self.table1}.id={self.table2}.{self.table1}_id'


@to_serializable
async def select_as_json(table_name, cond=None, val=None):
    if type(table_name) == SQL_JOIN:
        field_name = ""
        if not table_name.first:
            table = way_guider[table_name.table1]
            field_name = table_name.table2
            pipeline = [
                {
                    '$lookup': {
                        'from': table_name.table2,      # The foreign collection
                        'localField': "_id",           # Field in the input (local) collection
                        'foreignField': table_name.table1+"_id",        # Field in the 'from' (foreign) collection
                        'as': table_name.table2                # Name of the output array field
                    }
                }
            ]
        else:
            table = way_guider[table_name.table2]
            field_name = table_name.table1
            pipeline = [
                {
                    '$lookup': {
                        'from': table_name.table1,      # The foreign collection
                        'localField': table_name.table1+"_id",           # Field in the input (local) collection
                        'foreignField': "_id",        # Field in the 'from' (foreign) collection
                        'as': table_name.table1                # Name of the output array field
                    }
                }
            ]
        if cond:
            pipeline.append({
                "$match": {cond: val}
            })
        res = await table.aggregate(pipeline).to_list()
        json_res=[]
        for row in res:
            json_row = {}
            if len(row[field_name]) == 0: continue
            for key in row:
                if key!=field_name:
                    json_row[key] = row[key]
                else:
                    for values in row[field_name]:
                        for newkey in values:
                            if newkey == "_id": 
                                json_row[field_name+".id"] = values[newkey]
                                continue
                            json_row[newkey] = values[newkey]
            json_res.append(json_row)
        return json_res    
    if table_name in await way_guider.list_collection_names():
        table = way_guider[table_name]
        if cond:
            res = await table.find({cond: val}).to_list()
        else:   
            res = await table.find().to_list()
        return res
    else:
        raise AbsentTableException("Table not exist!")


async def insert_from_json(table_name, data_json):
    table = way_guider[table_name]
    x = await table.insert_one(data_json)
    return x.inserted_id

async def update_from_json(table_name, data_json, value, col_name='_id'):
    if table_name in await way_guider.list_collection_names():
        table = way_guider[table_name]
        await table.update_one({col_name: value}, {"$set": data_json})
    else:
        raise AbsentTableException("Table not exist!")
        

async def delete_from_table(table_name, value, col_name='_id'):
    if table_name in await way_guider.list_collection_names():
        table = way_guider[table_name]
        await table.delete_one({col_name: value})
    else:
        raise AbsentTableException("Table not exist!")

async def get_count(table_name):
    return await way_guider[table_name].estimated_document_count()
