import getopt
import sys
import numpy
import mrcfile
from pylab import *
from scipy.ndimage import measurements
from cloudvolume.lib import mkdir

def main(argv):
    print("Starting classmask deconstruction...")
    file = ''

    try:
        opts, args = getopt.getopt(argv, "hi:", ["input="])
    except getopt.GetoptError:
        print("error")
        sys.exit(2)
    for opt, arg in opts:
        if opt == '-h':
            print('extract_header.py -i <inputfile>')
            sys.exit()
        elif opt in ("-i", "--input"):
            file = arg
    
    basepath_arr = file.split("/")
    print(basepath_arr)
    basepath = '/'.join(basepath_arr[0:len(basepath_arr)-1])
    print(basepath)
    mrc = mrcfile.mmap(file, mode='r+', permissive=True)
    arr = mrc.data
    #print(type(arr))
    classes = numpy.unique(arr)
    print("Found main objects: ")
    #print(classes)
    classes = numpy.delete(classes,[0]) #delete 0 if present
    classes = classes.astype(float32)
    print(classes)
    s =  [
        [
        [1,1,1],
        [1,1,1],
        [1,1,1]
        ],
        [
        [1,1,1],
        [1,1,1],
        [1,1,1]
        ],
        [
        [1,1,1],
        [1,1,1],
        [1,1,1]
        ]
    ]
    for el in classes:
        newArr= numpy.where(arr == el, arr, 0) #make a new mrc, filled with 0 and only the objects with the given id.
        #print(newArr)
        lw,num = measurements.label(newArr,structure=s)
        #print(lw)
        print(num) #classes found.
        finalArr = numpy.where(lw is not 0, lw+el*1000, 0)
        finalArr = finalArr.astype(float32)
        p=mkdir(basepath+"/splitClassmask/")
        with mrcfile.new(p+"/"+str(el)+'_split.mrc', overwrite=True) as mrc:
            mrc.set_data(finalArr)
        
if __name__ == "__main__":
    main(sys.argv[1:])
