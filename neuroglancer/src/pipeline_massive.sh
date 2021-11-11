#activate the correct python environment with mrcfile, imod. 
#this is for massive, so module load is used, on other machines this may look different.
source ~/lf98_scratch/miniconda/bin/activate;
conda activate jupyterlab;
module load imod;

while [[ $# -gt 0 ]]; do
  key="$1";

  case $key in
    -p|--path)
      mypath="$2"
      shift # past argument
      shift # past value
      ;;
    --default)
      DEFAULT=YES
      shift # past argument
      ;;
    *)    # unknown option
      POSITIONAL+=("$1") # save it in an array for later
      shift # past argument
      ;;
  esac
done

#create necessary folders in target folder
mkdir -p "${mypath}/output/";
mkdir -p "${mypath}/res/";

#generate the info file from header....
for i in  "${mypath}/*.mrc" 
do

    #unstack the mrc to tif files
    mrc2tif "$i" "${mypath}/output/";
    #use correct python setup with the correct libraries to execute extract_header. 
    #This will create a readable header information file, and a info file needed by neuroglancer
    ~/lf98_scratch/miniconda/envs/jupyterlab/bin/python extract_header.py -i $i;
    
    #neuroglancer-scripts: creates precomputed format as well as the scales.
    slices-to-precomputed "${mypath}/output" "${mypath}/res/" ;
    compute-scales "${mypath}/res/";
done

echo "+++++++++++++++++++"
echo  "Successfully created all necessary files." 
echo  "If this is not the host machine, please copy the folders to the host." 
echo  "Update the database to point to the host folder."
echo "+++++++++++++++++++"