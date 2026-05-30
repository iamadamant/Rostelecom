from urllib.parse import quote, quote_plus

from fastapi import FastAPI, Header
from fastapi import Body, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

# from fastapi.staticfiles import StaticFiles

from bson import ObjectId

from PyJWT import jwt

from db.nosql_db_handler import select_as_json, insert_from_json, update_from_json, delete_from_table, get_count, SQL_JOIN

SECRET_KEY = "jkvgdnhuihe98rt3v3@ih8i*N89"
DEVELOP_MODE = False

MIDDLE_FUEL_CONSUMPTION = 14.8

app = FastAPI()

origins = [
    "null",
]

develop_origin = [
    '*'
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=develop_origin,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-User-Mode", "X-User-Name", "X-User-Crew"]
)

@app.post("/many/closed_routes")
async def send_routes_to_apply(data = Body()):
    try:
        for row in data:
            row["_id"] = ObjectId(row["_id"])
            await delete_entity("routes", row["_id"])
            res = await insert_from_json("closed_routes", row)
        return JSONResponse({"status": "OK"}, status_code=200)
    except Exception as e:
        return Response("Invalid values", status_code=400)
    
@app.get("/fuel")
async def get_fuel_consumptiopns():
    try:
        res = await select_as_json("fuel_consumption")
        answ = {}
        for row in res:
            if row["crews_code"] in answ:
                answ[row["crews_code"]][row["date"]] = row["consumption"]
            else: 
                answ[row["crews_code"]] = {}
                answ[row["crews_code"]][row["date"]] = row["consumption"]
        return answ
    except Exception as e:
        print(e)
    
@app.delete("/many/closed_routes")
async def delete_routes(data = Body()):
    try:
        for row in data:
            consumption = (float(row["length"])/1000)/100*MIDDLE_FUEL_CONSUMPTION
            fuel_json = {
                "crews_code": row["crews_code"], 
                "consumption":consumption,
                "date": datetime.now().strftime("%H:%M:%S %d-%m-%Y")
            }
            await insert_from_json("fuel_consumption", fuel_json)
            await delete_entity("closed_routes", ObjectId(row["_id"]))
    except Exception as e:
        print(e)
        return Response("Invalid values", status_code=400)
    
@app.post("/many/routes")
async def refuse_routes(data = Body()):
    try:
        for row in data:
            row["_id"] = ObjectId(row["_id"])
            await delete_entity("closed_routes", row["_id"])
            res = await insert_from_json("routes", row)
        return JSONResponse(res, status_code=200)
    except Exception as e:
        print(e)
        return Response("Invalid values", status_code=400 )

@app.get("/count/{table_name}")
async def get_count_table_rows(table_name: str):
    count = await get_count(table_name)
    return {"count": count}

@app.post("/api/login")
async def login_user(response: JSONResponse, body = Body()):
    telephone = body["telephone"]
    password = body["password"]
    users = await select_as_json("workers", cond="telephone", val=telephone)
    if len(users)==0:
        return JSONResponse("telephone", status_code=403)
    user = users[0]
    if user.get("password") != password:
        return JSONResponse("password", status_code=403)
    crews=user["crews_code"]
    response.headers["X-User-Name"] = quote(user["FIO"])
    response.headers["X-User-Crew"] = crews
    print(response.headers)
    return jwt.encode({
        "id": user["_id"],
        "telephone": telephone,
        "role": user["role"],
    }, SECRET_KEY, algorithm="HS256")

@app.get("/right/{table_name1}/{table_name2}")
async def read_two_tables(table_name1: str,table_name2: str):
    try:
        return await select_as_json(SQL_JOIN(table_name1, table_name2, first=True))
    except Exception as e:
        return JSONResponse([], status_code=400)

@app.get("/{table_name}")
async def read_root(response: JSONResponse, table_name: str, Authorization = Header("")):
    try:
        if table_name == 'routes':
            token = str(Authorization).split(' ')[1]
            user_json = jwt.decode(token, SECRET_KEY, algorithms="HS256")
            role = "admin" if DEVELOP_MODE else user_json["role"]
            if role == "high-engineer" or role == "admin" or role == "manager":
                response.headers['X-User-Mode'] = "modify"
                return await select_as_json("routes")
            elif role == "engineer":
                response.headers['X-User-Mode'] = "submit"
            try:
                crews = (await select_as_json("workers", cond="telephone", val=user_json["telephone"]))[0].get("crews_code")
                return await select_as_json("routes", cond="crews_code", val=crews)
            except IndexError:
                return JSONResponse("No such user!", status_code=400)
        return await select_as_json(table_name)
    except IndexError as ie:
        print(ie)
        return Response("No entities!", status_code=400)
    except Exception as e:
        return JSONResponse([], status_code=400)

@app.get("/{table_name}/{item_id}")
async def read_item(table_name: str, item_id: str, q: str | None = None):
    try:
        return await select_as_json(table_name, cond='_id', val=ObjectId(item_id))
    except Exception as e:
        return JSONResponse([], status_code=400)

@app.get("/left/{table_name1}/{table_name2}")
async def read_two_tables(table_name1: str,table_name2: str):
    try:
        return await select_as_json(SQL_JOIN(table_name1, table_name2))
    except Exception as e:
        print(e)
        return JSONResponse([], status_code=400)
    
@app.get("/{table_name1}/{col}/{val}")
async def read_entity_from_two_tables(table_name1: str, col:str, val:str):
    try:
        if "_id" in col:
            val = ObjectId(val)
        return await select_as_json(table_name1, cond=col, val=val)
    except Exception as e:
        return JSONResponse([], status_code=400)
    
@app.post("/{table_name}")
async def create_entity(table_name:str, data = Body()):
    try:
        print(data)
        for key in data:
            if "_id" in key:
                data[key] = ObjectId(data[key])
        res = await insert_from_json(table_name, data)
        return JSONResponse({"status": "OK"}, status_code=200)
    except Exception as e:
        print(e)
        return Response("Invalid values", status_code=400)

@app.put("/{table_name}/{id}")
async def update_entity(table_name:str, id:str, data = Body()):
    try:
        await update_from_json(table_name, data, ObjectId(id))
        return Response(status_code=200)
    except Exception as e:
        return Response("Invalid values", status_code=400)
    
@app.delete("/{table_name}/{id}")
async def delete_entity(table_name:str, id:str):
    try:
        await delete_from_table(table_name, ObjectId(id))
        return Response(status_code=204)
    except Exception as e:
        return Response("Invalid values", status_code=400)


# app.mount("/static", StaticFiles(directory="static"), name="static")