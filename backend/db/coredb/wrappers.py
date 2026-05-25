def to_serializable(fn, *args, **kwargs):
    async def wrapper(*args, **kwargs):
        obj = await fn(*args, **kwargs)
        for item in obj:
            for key in item:
                item[key] = str(item[key])
        return obj
    return wrapper

# pipeline = [
#             {
#                 '$lookup': {
#                     'from': table_name.table1,      # The foreign collection
#                     'localField': table_name.table1+"_id",           # Field in the input (local) collection
#                     'foreignField': "_id",        # Field in the 'from' (foreign) collection
#                     'as': table_name.table1                # Name of the output array field
#                 }
#             }
#         ]