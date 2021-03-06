import mrcfile
import sys
import getopt
import json
import os

# this script extracts relevant information from the header to be used in the online app.
# it will then call image_conversion.py script to convert the slices to Neuroglancer precomputed
# format using the data extracted from the header.

def main(argv):
    print("Starting header extraction...")
    inputfile = ''
    basepath = ''
    name = ''
    output = {}
    #segm = False
    try:
        opts, args = getopt.getopt(argv, "hi:s:", ["ifile="])
    except getopt.GetoptError:
        print("error")
        sys.exit(2)
    for opt, arg in opts:
        if opt == '-h':
            print('extract_header.py -i <inputfile>')
            sys.exit()
        elif opt in ("-i", "--ifile"):
            inputfile = arg

    tmp = inputfile.split("/")
    basepath = "/".join(tmp[0:len(tmp)-1])
    name = tmp[len(tmp)-1].split(".")[0]  # file name
    outputfile = basepath+"/bucket/dataset/image/"+name+".json"
    print(outputfile)
    mrc = mrcfile.mmap(inputfile, mode='r+')
 
    voxelsize = [mrc.voxel_size.x/10,mrc.voxel_size.y/10,mrc.voxel_size.z/10]
    # print(voxelsize)
    sx = mrc.header.nx.item(0)
    sy = mrc.header.ny.item(0)
    sz = mrc.header.nz.item(0)
    output["x"] = mrc.header.nx.item(0)
    output["y"] = mrc.header.ny.item(0)
    output["z"] = mrc.header.nz.item(0)
    output["pixel_spacing"] = voxelsize
    output["min"] = mrc.header.dmin.item(0)
    output["max"] = mrc.header.dmax.item(0)
    output["mean"] = mrc.header.dmean.item(0)
    mrc.close()

    # saves some information to be used in the app later
    with open(outputfile, 'w+') as f:
        print(outputfile)
        json.dump(output, f)

    print("Done extracting header.")

    print("----")
    #call image conversion for the image. This is stupid, but the ProcessPoolExecutor in the conversion file doesn't like main functions, so this is the quick and dirty
    #solution
    #False boolean for isSegmentation
    os.system('python ../image_conversion.py ' + basepath+"/bucket/dataset/image " + basepath+"/image_slices " + str(sx) + " " + str(sy) + " " + str(sz) + " False")
    
if __name__ == "__main__":
    main(sys.argv[1:])
