import pandas as pd
import sys
import json

templates = sys.argv[1]
dataFolder=sys.argv[2]
df = pd.read_csv(templates)


res = {}
res["@type"] = "neuroglancer_segment_properties"
res["inline"] = {
    "ids": df['id'].to_list(),
    "properties":[
        {"id":"label",
        "type":"label",
        "values": df["label"].to_list()},
        {"id":"description",
        "type":"description",
        "values": df["name"].to_list()},
    ]
}
#print(res)

with open(dataFolder + "segmentation_properties/info",'w') as f:
    json.dump(res,f)

#add segment_properties entry to info file of segmentation
jsonfile = open(dataFolder+"/info","r")
obj = json.load(jsonfile)
jsonfile.close()
obj["segment_properties"] = "segmentation_properties"
jsonfile = open(dataFolder+"/info","w")
json.dump(obj, jsonfile)
jsonfile.close()
#with open(dataFolder+"/info",'w') as f:
#    json.dump(df1.to_json(orient="records"),f)
#target format :
# {
#   "@type": "neuroglancer_segment_properties",
#   "inline": {
#     "ids": [
#       "1",
#       "2",
#       "3",
#       "4",
#       "5",
#       "6",
#       "7",
#       "8",
#       "9",
#       "10",
#       "11",
#       "12",
#       "13",
#       "14",
#       "15"
#     ],
#     "properties": [
#       {
#         "id": "label",
#         "type": "label",
#         "values": [
#           "TRiC-CCT",
#           "Proteasome26S",
#           "ClpB",
#           "Rubisco",
#           "P97-vcp",
#           "Cand1-Cul1-Roc1",
#           "Sse1",
#           "Hsp90-Sba1",
#           "GET3",
#           "Ssb1",
#           "LJ0536",
#           "Hsp70ATPase",
#           "Ribosome",
#           "what_is",
#           "this"
#         ]
#       },
#       {
#         "id": "description",
#         "type": "description",
#         "values": [
#           "TRiC-CCT",
#           "Proteasome26S",
#           "ClpB",
#           "Rubisco",
#           "P97-vcp",
#           "Cand1-Cul1-Roc1",
#           "Sse1",
#           "Hsp90-Sba1",
#           "GET3",
#           "Ssb1",
#           "LJ0536",
#           "Hsp70ATPase",
#           "Ribosome",
#           "Large Sphere",
#           "Extra Object"
#         ]
#       }
#     ]
#   }
# }