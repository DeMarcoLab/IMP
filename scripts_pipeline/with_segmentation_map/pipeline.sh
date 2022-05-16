#older pipeline using segmentation maps to create segmentation layer as well as automatically generate meshes.
SECONDS=0;
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

echo ${mypath}

# #enable processing of hidden files starting with .
shopt -s dotglob
#generate the info file from header....'''
for i in  "${mypath}/*.mrc" 
do

    echo $i
    #unstack the mrc to tif files, index starting at 1
    rm -r "${mypath}/image_slices"
    mkdir -p "${mypath}/image_slices"
    mrc2tif $i "${mypath}/image_slices/";
    mkdir -p "${mypath}/bucket/dataset/image"
    #convert classmask to correct format
    myarray=(`find ${mypath}/segmentation -maxdepth 1 -name "*.mrc"`)
    if [ ${#myarray[@]} -gt 0 ]; then 
        echo "Found a segmentation file. Will attempt conversion to segmentation layer.\n" 
        echo $myarray[0]
        rm -r "${mypath}/segmentation_slices/"
        mkdir -p "${mypath}/bucket/dataset/segmentation/segmentation_properties"
        mkdir =p "${mypath}/segmentation_slices/"
        newstack -in $myarray -ou "${mypath}/segmentation/int_segmentation.mrc" -mode 6
        #mrc2tif "${mypath}/segmentation/int_segmentation.mrc" "${mypath}/segmentation_slices/"
        python extract_header.py -i $i -s True;
    else 
        echo "Found no class mask or segmentation file."
        python extract_header.py -i $i -s Fakse;
    fi

done

echo "All done in " $SECONDS " seconds"

