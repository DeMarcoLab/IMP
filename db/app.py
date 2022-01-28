import json
from turtle import update

import pandas as pd
import pymongo
import streamlit as st


from st_aggrid import AgGrid, GridUpdateMode
from st_aggrid.grid_options_builder import GridOptionsBuilder

def get_bio_db(name="bio_db"):
    pymongo_client = pymongo.MongoClient()

    bio_db = pymongo_client[name]

    return bio_db


st.set_page_config(page_title="Database UI", layout="wide")

# TODO: session state https://blog.streamlit.io/session-state-for-streamlit/

# CREATE - DONE
# READ - DONE
# UPDATE - DONE
# DELETE - DONE


def main():

    st.title("Database UI")

    bio_db = get_bio_db()

    # mode = st.sidebar.selectbox("Select a Mode", ["Search", "Insert"])

    # if mode == "Search":
    #     query_form = st.form(key="query")
    #     collection = query_form.selectbox(
    #         "Select a collection", bio_db.list_collection_names()
    #     )

    #     query_text = query_form.text_area("Search query", {})

    #     query_submit_button = query_form.form_submit_button("Search")

    #     if query_submit_button:

    #         query_json = json.loads(query_text)
    #         st.write("Query: ", query_json)

    #         query_result = list(
    #             bio_db[collection].find(query_json, {"_id": 0})
    #         )  # return all cols except internal object _id

    #         df_table = pd.DataFrame(query_result)

    #         st.header("Results")
    #         st.table(df_table)

    #         return_table = AgGrid(
    #             df_table,
    #             editable=True,
    #             theme="streamlit",
    #             fit_columns_on_grid_load=True,
    #             update_mode=GridUpdateMode.MANUAL,
    #         )

    #         # dont fully refresh when editing table?
    #         st.write("---")
    #         st.write(return_table["data"])

    # if mode == "Insert":

    collection = st.selectbox("Select a collection", bio_db.list_collection_names())
    query_text = st.text_input("Search query", {})

    st.write(query_text)
    if query_text == "":
        query_text = "{}"
    query_json = json.loads(query_text)

    query_result = list(
        bio_db[collection].find(query_json, {"_id": 0})
    )  # return all cols except internal object _id
    df_table = pd.DataFrame(query_result)

    gb = GridOptionsBuilder.from_dataframe(df_table)
    gb.configure_pagination()
    gb.configure_selection(selection_mode="single", use_checkbox=True)
    gridOptions = gb.build()

    df_new = AgGrid(
        df_table,
        gridOptions=gridOptions,
        theme="streamlit",
        fit_columns_on_grid_load=True,
        update_mode=GridUpdateMode.SELECTION_CHANGED,
    )


    cols = st.columns(3)

    # insert
    insert_form = cols[0].form(key="insert")
    insert_form.subheader("Add Data")
    insert_text = insert_form.text_area("Data to Add", {})
    insert_json = json.loads(insert_text)

    insert_submit_button = insert_form.form_submit_button("Add")

    if insert_submit_button:
        cols[0].write(insert_json)
        bio_db[collection].insert_one(insert_json)
        # {"user_name": "Peter Parker",  "user_id": 4, "user_location": "Melbourne, Australia",  "user_institution": "Monash University"}

        insert_form.success("Sucessfully added data to the database")
        # TODO: refresh table on update?

    # update
    update_form = cols[1].form(key="update")
    selected_data = df_new["selected_rows"]
    update_form.subheader("Update Data")
    update_data = update_form.text_area("Updated Data: ", selected_data)

    update_form_button = update_form.form_submit_button("Update")

    # TODO: doesnt work with nested dictionary

    if update_form_button:

        # TODO: assert correct json?
        update_json = json.loads(update_data.replace("'", '"'))[
            0
        ]  # TODO: generalise all this

        update_json = {"$set": update_json}

        bio_db[collection].update_one(selected_data[0], update_json, upsert=True)
        update_form.success("Successfully updated the database.")

    # delete
    delete_form = cols[2].form(key="delete")
    selected_data = df_new["selected_rows"]
    delete_form.subheader("Delete Data")
    delete_form.write(selected_data)

    delete_form_button = delete_form.form_submit_button("Delete")

    if delete_form_button:

        # TODO: assert correct json?
        delete_json = selected_data[0]
        st.write(delete_json)

        bio_db[collection].delete_one(delete_json)
        delete_form.success("Successfully deleted data from the database.")

# TODO
# when keys are null, can't delete the row
# beter inserting of columns, rather than having to write it in json


if __name__ == "__main__":
    main()


# print(myclient.list_database_names())
# st.write("Collections: ", bio_db.list_collection_names())

# for col_name in bio_db.list_collection_names():

#     collection = bio_db[col_name]
#     st.write("Collection: ", col_name)
#     for x in collection.find():
#         st.write(x)
