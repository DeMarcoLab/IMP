import os
from concurrent.futures import ProcessPoolExecutor
import getopt
import numpy as np
import tifffile
import sys
from cloudvolume import CloudVolume
from cloudvolume.lib import mkdir, touch


#converts a folder of tif slices to Neuroglancer precomputed format. 
#Can convert image and segmentation layer. This should be called from extract_header.py

print("Starting image conversion ... ")
#print(sys.argv)
# args parsing
basepath = sys.argv[1]
sliceLocation = sys.argv[2]
x = sys.argv[3]
y = sys.argv[4]
z = sys.argv[5]
segmentation = sys.argv[6]

if(segmentation == 'True'):
    info = CloudVolume.create_new_info(
        num_channels=1,
        layer_type=  'segmentation',  # 'image' or 'segmentation'
        data_type='uint16',  # can pick any popular uint
        # other options: 'jpeg', 'compressed_segmentation' (req. uint32 or uint64)
        encoding='raw',
        resolution=[1, 1, 1],  # X,Y,Z values in nanometers
        voxel_offset=[0, 0, 0],  # values X,Y,Z values in voxels
        chunk_size=[256, 256, 1],  # rechunk of image X,Y,Z in voxels
        volume_size=[x, y, z],  # X,Y,Z size in voxels
        )
else:
    info = CloudVolume.create_new_info(
    num_channels=1,
    layer_type= 'image',  # 'image' or 'segmentation'
    data_type='float32',  # can pick any popular uint
    # other options: 'jpeg', 'compressed_segmentation' (req. uint32 or uint64)
    encoding='raw',
    resolution=[1, 1, 1],  # X,Y,Z values in nanometers
    voxel_offset=[0, 0, 0],  # values X,Y,Z values in voxels
    chunk_size=[256, 256, 1],  # rechunk of image X,Y,Z in voxels
    volume_size=[x, y, z],  # X,Y,Z size in voxels

    )
try:
    # If you're using amazon or the local file system, you can replace 'gs' with 's3' or 'file'
    vol = CloudVolume('file://'+basepath, info=info)
    # vol.provenance.owners = ['email_address_for_uploader/imager'] # list of contact email addresses

    vol.commit_info()  # generates gs://bucket/dataset/layer/info json file
    # vol.commit_provenance() # generates gs://bucket/dataset/layer/provenance json file
    #print(vol)
    #direct = './segm_slices/'

    progresspath = 'segm_progess/' if segmentation == 'True' else 'img_progress/'
    # unlike os.mkdir doesn't crash on prexisting
    progress_dir = mkdir(basepath+'/' + progresspath)
    done_files = set([int(z) for z in os.listdir(progress_dir)])
    all_files = set(range(vol.bounds.minpt.z, vol.bounds.maxpt.z))

    to_upload = [int(z) for z in list(all_files.difference(done_files))]
    to_upload.sort()
    # print(to_upload)
except IOError as err:
    errno, strerror = err.args
    print('I/O error({0}): {1}'.format(errno, strerror))
    print(err)
except ValueError as ve:
    print('Could not convert data to an integer.')
    print(ve)
except:
    print('Unexpected error:', sys.exc_info()[0])
    raise

def process(z):

    #print(z)

    try:
        img_name = '.%03d.tif' % z
        print('Processing ', img_name)
        #print(os.path.join(direct, img_name))
        image = tifffile.imread(os.path.join(sliceLocation, img_name))

        image = np.swapaxes(image, 0, 1)
        # print(image)
        image = image[..., np.newaxis]
        vol[:, :, z] = image
        touch(os.path.join(progress_dir, str(z)))
    except IOError as err:
        errno, strerror = err.args
        print('I/O error({0}): {1}'.format(errno, strerror))
        print(err)
    except ValueError as ve:
        print('Could not convert data to an integer.')
        print(ve)
    except:
        print('Unexpected error:', sys.exc_info()[0])
        raise

with ProcessPoolExecutor(max_workers=8) as executor:
    executor.map(process, to_upload)
