import mrcfile
import sys
import getopt
import json
import os

# this script extracts relevant information from the header to be used in the online app.
def main(argv):
    print("Starting header extraction...")
    inputfile = ''
    basepath = ''
    name = ''
    output = {}
    segm = False
    try:
        opts, args = getopt.getopt(argv, "hi:s:", ["ifile=segment="])
    except getopt.GetoptError:
        print("error")
        sys.exit(2)
    for opt, arg in opts:
        if opt == '-h':
            print('extract_header.py -i <inputfile>')
            sys.exit()
        elif opt in ("-i", "--ifile"):
            inputfile = arg
        elif opt in ("-s", "--segment"):
            segm = arg

    tmp = inputfile.split(".")[len(inputfile.split('.'))-2]
    l = tmp.split("/")[:-1]
    basepath = "/".join(l)
    name = tmp.split("/")[len(tmp.split("/"))-1]  # file name
    outputfile = basepath+"/bucket/dataset/"+name+".json"
    # print(outputfile)
    mrc = mrcfile.mmap(inputfile, mode='r+')

    voxelsize = [mrc.voxel_size.x/10, mrc.voxel_size.y /
                 10, mrc.voxel_size.z/10]  # convert from angstrom
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
    os.system('python image_conversion.py ' + basepath+"/bucket/dataset/image " + basepath+"/image_slices " + str(sx) + " " + str(sy) + " " + str(sz) + " False")
    print(segm)
    if(segm == 'True'):
        directory = basepath+"/segmentation/splitClassmask"
        for filename in os.listdir(directory):
            f = os.path.join(directory,filename)
            print(f)
            print(filename)
            os.system('rm -r '+basepath+"/bucket/dataset/layers/"+filename)
            os.system('mkdir '+basepath+"/bucket/dataset/layers/"+filename)
            os.system("mrc2tif " + f + " " + f + "/slices")
            #os.system('python image_conversion.py ' + basepath+"/bucket/dataset/layers/${filename} " +  "${f}/slices "  + str(sx) + " " + str(sy) + " " + str(sz) + " True")
            #os.system('python meshing.py file://'+ basepath+"/bucket/dataset/layers/${filename}  " + str(sx) + " " + str(sy) + " " + str(sz))
            
            #TODO: Make a correct properties file for each created layer of particles.
            
            #os.system('python makeSegmentation_properties.py ' + basepath+"/particlelabels/templates.csv " + basepath+"/bucket/dataset/segmentation/")

if __name__ == "__main__":
    main(sys.argv[1:])
