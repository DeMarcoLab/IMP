from flask import Flask
from flask_cors import CORS
from flask import Flask, render_template, request, redirect, jsonify
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

app = Flask(__name__)
app.debug = True
app.config['JSON_AS_ASCII'] = False
app.config['UPLOAD_PATH'] = "./static"
from bson import ObjectId
from flask_pymongo import PyMongo

app = Flask(__name__)
app.config["MONGO_URI"] = "mongodb://127.0.0.1:27017/dna"
mongo = PyMongo(app)


app.config["SECRET_KEY"] = '79537d00f4834892986f09a100aa1edf'

CORS(app, supports_credentials=True)
# init_app for recursive quote
db.init_app(app)
with app.app_context():
    db.create_all()
import copy
import time


@app.route("/logout")
def logout():
    resp = redirect("/login")
    resp.delete_cookie("name")
    resp.delete_cookie("auth")
    return resp


@app.route("/")
def home():
    return redirect("/index")


def getUserinfo():
    return {"username": request.cookies.get("name"), "auth": int(request.cookies.get("auth"))}


def get_pageList(count):
    all_page = []
    for i in range(1, int(count / 15 + 2)):
        all_page.append(i)
    return all_page


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "GET":
        return render_template('signup.html')
    user_name = request.form.get("user_name")
    email = request.form.get("email")

    institution = request.form.get("institution")
    password = request.form.get("password")
    users = mongo.db.users.find_one({"email": email})

    if user_name is None or user_name == "":
        msg = "Username cannot be empty"
    elif email is None or email == "":
        msg = "Email cannot be empty"
    elif institution is None or institution == "":
        msg = "institution cannot be empty"
    elif password is None or password == "":
        msg = "password cannot be empty"
    elif users is not None:
        msg = "The email has been registered"
    else:
        mongo.db.users.insert_one(
            {"user_name": user_name, "email": email, "institution": institution, "password": password, "status": 1,
             "auth": 1})
        return redirect("/login")
    return render_template('signup.html', msg=msg)


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == 'GET':
        return render_template('login.html')
    email = request.form.get("email")

    password = request.form.get("password")
    user = mongo.db.users.find_one({"email": email})
    print(user)
    if user is None:
        msg = "The user does not exist"
    elif user["status"] == 0:
        msg = "The user is frozen"
    elif user["password"] != password:
        msg = "Incorrect password"
    else:
        resp = redirect("/index")

        resp.set_cookie("auth", str(user["auth"]), max_age=360000)
        resp.set_cookie("name", user["user_name"], max_age=360000)
        return resp

    return render_template('login.html', msg=msg)


import re


@app.route("/index")
def index():
    if request.cookies.get("auth") is None:
        return redirect("/login")

    page = request.args.get("page")
    keyword = request.args.get("keyword")
    if page is None:
        page = 1
    start_index = (int(page) - 1) * 15
    count = mongo.db.data.count()
    if keyword is not None and keyword != "":

        data = mongo.db.data.find({"$or": [{'sample_id': re.compile(keyword)}, {'sample_name': re.compile(keyword)},
                                           {'user_name': re.compile(keyword)}, {'address': re.compile(keyword)},
                                           {'information': re.compile(keyword)},
                                           {'process': re.compile(keyword)}]}).skip(start_index).limit(15)
    else:
        data = mongo.db.data.find().skip(start_index).limit(15)

    return render_template('index.html', data=data, all_page=get_pageList(count), page=int(page), cookie=getUserinfo(),
                           keyword=keyword)


@app.route("/user/edit", methods=["GET", "POST"])
def userEdit():
    if request.cookies.get("auth") is None:
        return redirect("/login")
    if request.cookies.get("auth") not in (3,"3"):
        return redirect("/index")
    id = request.args.get("id")

    user = mongo.db.users.find_one({"_id": ObjectId(id)})

    if request.method == "GET":
        return render_template('authUser.html', user=user, cookie=getUserinfo())
    auth = request.form.get("auth")
    mongo.db.users.update({"_id": ObjectId(id)}, {"$set": {"auth": int(auth), "status": 1}})
    return redirect("/user/list")


@app.route("/user/list")
def userList():
    if request.cookies.get("auth") is None:
        return redirect("/login")
    if request.cookies.get("auth") not in (3,"3"):
        return redirect("/index")
    keyword = request.args.get("keyword")

    page = request.args.get("page")
    if page is None:
        page = 1
    start_index = (int(page) - 1) * 15
    count = mongo.db.users.count()
    if keyword is not None and keyword != "":

        users = mongo.db.users.find({"$or": [{'user_name': re.compile(keyword)}, {'email': re.compile(keyword)},
                                            {'institution': re.compile(keyword)}]}).skip(start_index).limit(15)
    else:
        users = mongo.db.users.find().skip(start_index).limit(15)
    return render_template('user.html', users=users, all_page=get_pageList(count), page=int(page), cookie=getUserinfo())


@app.route("/data/del")
def dataDel():
    if request.cookies.get("auth") is None:
        return redirect("/login")
    id = request.args.get("id")
    field = request.args.get("field")
    mongo.db.data.update({"_id": ObjectId(id)}, {"$unset": {field: ""}})
    return jsonify({"code": 1})


@app.route("/data/detail")
def dataShow():
    if request.cookies.get("auth") is None:
        return redirect("/login")
    id = request.args.get("id")
    if id is not None and id != "":
        data = mongo.db.data.find_one({"_id": ObjectId(id)})
        fieldList = []
        for i in data:
            if isinstance(data[i], dict):
                if data[i]["type"] != "file":
                    dict1 = {"name": i, "type": data[i]["type"], "value": data[i]["value"]}
                    fieldList.append(dict1)
        return render_template('dataDetail.html', data=data, fieldList=fieldList, cookie=getUserinfo())


@app.route("/data/image")
def dataImage():
    if request.cookies.get("auth") is None:
        return redirect("/login")
    id = request.args.get("id")
    if id is not None and id != "":
        data = mongo.db.data.find_one({"_id": ObjectId(id)})
        fieldList = []
        for i in data:
            if isinstance(data[i], dict):
                if data[i]["type"] == "file":
                    fieldList.append(data[i]["value"])
        return render_template('dataShow.html', fieldList=fieldList, cookie=getUserinfo())


@app.route("/data/edit/", methods=["GET", "POST"])
def dataEdit():
    if request.cookies.get("auth") is None:
        return redirect("/login")
    id = request.args.get("id")
    if id is not None and id != "":
        data = mongo.db.data.find_one({"_id": ObjectId(id)})
        fieldList = []
        for i in data:
            if isinstance(data[i], dict):
                dict1 = {"name": i, "type": data[i]["type"], "value": data[i]["value"]}
                fieldList.append(dict1)

    else:
        fieldList = mongo.db.filed.find()
        data = None
    if request.method == "GET":
        return render_template('dataOption.html', data=data, fieldList=fieldList, cookie=getUserinfo())
    dict1 = {}
    for i in request.form.keys():
        value = request.form.get(i)
        if value is None or value == "":
            continue
        iinfo = i.split("&")
        if len(iinfo) != 1:
            name = iinfo[0]
            type = iinfo[1]
            dict1[name] = {"value": value, "type": type}
        else:

            dict1[i] = value
    for i in request.files.keys():
        file = request.files.get(i)
        if file is None or file == "":
            continue
        filename = file.filename
        if filename is None or filename=="":
            continue

        name = i.split("&")[0]
        file.save("./static/image/" + filename)
        dict1[name] = {"type": "file", "value": "/static/image/" + filename}

    if id is not None and id != "":
        mongo.db.data.update({"_id": ObjectId(id)}, {
            "$set": dict1})
    else:
        mongo.db.data.insert_one(dict1)
    return redirect("/index")


@app.route("/field/list")
def filedList():
    if request.cookies.get("auth") is None:
        return redirect("/login")
    page = request.args.get("page")
    if page is None:
        page = 1
    start_index = (int(page) - 1) * 15
    count = mongo.db.filed.count()
    filedinfo = mongo.db.filed.find().skip(start_index).limit(15)
    return render_template('filed.html', filedinfo=filedinfo, all_page=get_pageList(count), page=int(page),
                           cookie=getUserinfo())


@app.route("/field/add", methods=["GET", "POST"])
def filedAdd():
    if request.cookies.get("auth") is None:
        return redirect("/login")
    if request.method == "GET":
        return render_template('filedAdd.html', cookie=getUserinfo())
    dict1 = {}
    for i in request.form.keys():
        value = request.form.get(i)
        if value is None or value == "":
            continue
        dict1[i] = value
    mongo.db.data.update_many({}, {"$set": {dict1["name"]: {"type": dict1["type"], "value": ""}}})
    mongo.db.filed.insert_one(dict1)
    return redirect("/field/list")


@app.route("/field/del")
def fieldDel():
    if request.cookies.get("auth") is None:
        return redirect("/login")
    id = request.args.get("id")
    field = mongo.db.filed.find_one({"_id": ObjectId(id)})
    mongo.db.data.update_many({}, {"$unset": {field["name"]: ""}})
    mongo.db.filed.remove({"_id": ObjectId(id)})
    return redirect("/field/list")

x = mongo.db.users.find_one()

print(x)

if __name__ == '__main__':
    app.run()
