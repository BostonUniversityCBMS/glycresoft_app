from setuptools import setup, find_packages


with open("glycresoft_app/version.py") as version_file:
    version = None
    for line in version_file.readlines():
        if "version = " in line:
            version = line.split(" = ")[1].replace("\"", "").strip()
            print("Version is: %r" % (version,))
            break
    else:
        print("Cannot determine version")


def run_setup(include_cext=True):
    setup(
        name='glycresoft_app',
        version=version,
        packages=find_packages(),
        author=', '.join(["Joshua Klein"]),
        author_email=["jaklein@bu.edu"],
        include_package_data=True,
        zip_safe=False,
        classifiers=[
            'Development Status :: 3 - Alpha',
            'Intended Audience :: Science/Research',
            'License :: OSI Approved :: BSD License',
            'Topic :: Scientific/Engineering :: Bio-Informatics'])


run_setup()
